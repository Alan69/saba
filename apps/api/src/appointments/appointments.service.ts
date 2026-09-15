import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, CarSize, PaymentMethod, Prisma } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtPayload, JwtRole } from '../common/auth.types';
import { dayRangeUtc } from '../common/time';

const genCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

/** FSM переходов: из → { в: разрешённые роли } (ТЗ 8.5) */
const FSM: Record<string, Partial<Record<AppointmentStatus, JwtRole[]>>> = {
  pending: { confirmed: ['owner', 'admin'], cancelled: ['owner', 'admin'] },
  confirmed: {
    in_progress: ['owner', 'admin', 'master'],
    cancelled: ['owner', 'admin'],
    no_show: ['owner', 'admin'], // вручную + автоматически cron'ом
  },
  in_progress: { done: ['owner', 'admin', 'master'] },
  done: { paid: ['owner', 'admin'], cancelled: ['owner'] },
  paid: {},
  cancelled: {},
  no_show: {},
};

const ACTIVE_STATUSES: AppointmentStatus[] = ['pending', 'confirmed', 'in_progress', 'done', 'paid'];

export interface CreateAppointmentInput {
  boxId: string;
  startAt: string;
  serviceId: string;
  employeeId?: string;
  clientId?: string;
  clientPhone?: string;
  clientName?: string;
  carBrand?: string;
  carPlate?: string;
  carSize?: CarSize;
  clientCarId?: string;
  price?: number;
  comment?: string;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async listByDate(user: JwtPayload, dateISO: string) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: user.company_id } });
    const { start, end } = dayRangeUtc(dateISO, company.timezone);
    const where: Prisma.AppointmentWhereInput = {
      companyId: user.company_id,
      startAt: { gte: start, lt: end },
      deletedAt: null,
      // мастер видит только свои записи (ТЗ 7)
      ...(user.role === 'master' ? { employeeId: user.employee_id } : {}),
    };
    return this.prisma.appointment.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        clientCar: true,
        service: { select: { id: true, name: true, durationMin: true } },
        employee: { select: { id: true, name: true } },
        box: { select: { id: true, name: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async resolvePrice(companyId: string, serviceId: string, carSize?: CarSize): Promise<number> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, companyId, deletedAt: null },
    });
    if (!service) throw new BadRequestException('Услуга не найдена');
    const bySize = (service.priceBySize as Record<string, number> | null) ?? null;
    if (carSize && bySize && bySize[carSize] != null) return Number(bySize[carSize]);
    return Number(service.price);
  }

  private async ensureNoOverlap(
    companyId: string,
    boxId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string,
  ) {
    const overlap = await this.prisma.appointment.findFirst({
      where: {
        companyId,
        boxId,
        deletedAt: null,
        status: { in: ['pending', 'confirmed', 'in_progress', 'done', 'paid'] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (overlap) throw new ConflictException('Слот уже занят');
  }

  async create(user: JwtPayload, input: CreateAppointmentInput) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: user.company_id } });
    if (company.mode !== 'active') {
      throw new ForbiddenException('Подписка истекла. Новые записи заблокированы');
    }
    const box = await this.prisma.box.findFirst({
      where: { id: input.boxId, companyId: user.company_id, deletedAt: null, status: 'active' },
    });
    if (!box) throw new BadRequestException('Бокс не найден');

    const service = await this.prisma.service.findFirst({
      where: { id: input.serviceId, companyId: user.company_id, deletedAt: null },
    });
    if (!service) throw new BadRequestException('Услуга не найдена');

    const startAt = new Date(input.startAt);
    if (Number.isNaN(startAt.getTime())) throw new BadRequestException('Неверное время');
    const endAt = new Date(startAt.getTime() + service.durationMin * 60_000);

    await this.ensureNoOverlap(user.company_id, input.boxId, startAt, endAt);

    // клиент: по id или по телефону (upsert)
    let clientId = input.clientId ?? null;
    let clientCarId = input.clientCarId ?? null;
    if (!clientId && input.clientPhone) {
      const client = await this.prisma.client.upsert({
        where: { companyId_phone: { companyId: user.company_id, phone: input.clientPhone } },
        update: { name: input.clientName ?? undefined, deletedAt: null },
        create: {
          companyId: user.company_id,
          phone: input.clientPhone,
          name: input.clientName,
        },
      });
      clientId = client.id;
    }
    if (!clientCarId && clientId && input.carBrand) {
      const car = await this.prisma.clientCar.create({
        data: {
          companyId: user.company_id,
          clientId,
          brand: input.carBrand,
          plateNumber: input.carPlate,
          size: input.carSize ?? 'M',
        },
      });
      clientCarId = car.id;
    }

    const carSize = input.carSize
      ?? (clientCarId
        ? (await this.prisma.clientCar.findUnique({ where: { id: clientCarId } }))?.size
        : undefined);
    const price = input.price ?? (await this.resolvePrice(user.company_id, input.serviceId, carSize ?? undefined));

    let appointment;
    try {
      appointment = await this.prisma.appointment.create({
        data: {
          companyId: user.company_id,
          boxId: input.boxId,
          clientId,
          clientCarId,
          employeeId: input.employeeId ?? null,
          serviceId: input.serviceId,
          code: genCode(),
          startAt,
          endAt,
          status: 'confirmed',
          price,
          originalPrice: price,
          source: 'admin',
          comment: input.comment,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Слот уже занят');
      throw e;
    }

    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'create', entity: 'appointment', entityId: appointment.id,
      details: { boxId: input.boxId, startAt: input.startAt, price },
    });
    return this.getById(user.company_id, appointment.id);
  }

  getById(companyId: string, id: string) {
    return this.prisma.appointment.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        clientCar: true,
        service: { select: { id: true, name: true, durationMin: true } },
        employee: { select: { id: true, name: true } },
        box: { select: { id: true, name: true } },
      },
    });
  }

  async transition(
    user: JwtPayload,
    id: string,
    to: AppointmentStatus,
    opts: { cancelReason?: string; paymentMethod?: PaymentMethod } = {},
  ) {
    const apt = await this.prisma.appointment.findFirst({
      where: { id, companyId: user.company_id, deletedAt: null },
    });
    if (!apt) throw new NotFoundException('Запись не найдена');

    // мастер — только свои записи
    if (user.role === 'master' && apt.employeeId !== user.employee_id) {
      throw new ForbiddenException('Только свои записи');
    }

    const allowedRoles = FSM[apt.status]?.[to];
    if (!allowedRoles) {
      throw new BadRequestException(`Переход ${apt.status} → ${to} запрещён`);
    }
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Недостаточно прав для этого перехода');
    }
    if (to === 'cancelled' && !opts.cancelReason) {
      throw new BadRequestException('Укажите причину отмены');
    }
    if (to === 'paid' && !opts.paymentMethod) {
      throw new BadRequestException('Укажите способ оплаты');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: to,
        ...(to === 'cancelled'
          ? { cancelReason: opts.cancelReason, cancelledBy: user.name ?? user.role }
          : {}),
        ...(to === 'paid' ? { paymentMethod: opts.paymentMethod, paidAt: new Date() } : {}),
      },
    });

    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: `status:${apt.status}->${to}`, entity: 'appointment', entityId: id,
      details: opts.cancelReason ? { cancelReason: opts.cancelReason } : {},
    });

    // анти-фрод: отмена из in_progress/done → колокольчик owner
    if (to === 'cancelled' && (apt.status === 'in_progress' || apt.status === 'done')) {
      await this.notifications.notify(
        user.company_id,
        'fraud_cancel',
        'Отмена записи в работе',
        `${user.name ?? 'Сотрудник'} отменил запись #${apt.code} в статусе «${apt.status === 'in_progress' ? 'В работе' : 'Завершена'}». Причина: ${opts.cancelReason}`,
      );
      // 3+ отмены одним сотрудником за день
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const cancels = await this.prisma.auditLog.count({
        where: {
          companyId: user.company_id,
          userId: user.sub,
          action: { contains: '->cancelled' },
          createdAt: { gte: today },
        },
      });
      if (cancels >= 3) {
        await this.notifications.notify(
          user.company_id,
          'fraud_cancel_series',
          'Серия отмен',
          `${user.name ?? 'Сотрудник'} отменил ${cancels} записи из работы за сегодня`,
        );
      }
    }

    if (to === 'paid') {
      await this.onPaid(updated.id);
    }
    return this.getById(user.company_id, id);
  }

  /** Оплата: обновить статистику клиента + начислить зарплату по правилам */
  private async onPaid(appointmentId: string) {
    const apt = await this.prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      include: { service: true },
    });
    if (apt.clientId) {
      await this.prisma.client.update({
        where: { id: apt.clientId },
        data: {
          visitsCount: { increment: 1 },
          totalSpent: { increment: apt.price },
          lastVisitAt: apt.startAt,
        },
      });
    }
    if (apt.employeeId) {
      const rules = await this.prisma.salaryRule.findMany({
        where: {
          companyId: apt.companyId,
          active: true,
          deletedAt: null,
          type: 'percent',
          OR: [{ employeeId: apt.employeeId }, { employeeId: null }],
        },
        orderBy: { sortOrder: 'asc' },
      });
      for (const rule of rules) {
        const cfg = rule.config as { percent?: number; serviceIds?: string[] };
        if (cfg.serviceIds?.length && apt.serviceId && !cfg.serviceIds.includes(apt.serviceId)) {
          continue;
        }
        const percent = Number(cfg.percent ?? 0);
        if (percent <= 0) continue;
        const amount = (Number(apt.price) * percent) / 100;
        await this.prisma.salaryAccrual.create({
          data: {
            companyId: apt.companyId,
            employeeId: apt.employeeId,
            appointmentId: apt.id,
            ruleId: rule.id,
            amount: new Prisma.Decimal(amount.toFixed(2)),
            periodDate: new Date(apt.startAt.toISOString().slice(0, 10)),
            note: `${percent}% от ${apt.service?.name ?? 'услуги'}`,
          },
        });
      }
    }
  }

  /** Изменение цены: owner свободно; admin ниже original_price — только с кодом owner (ТЗ 6.10) */
  async changePrice(user: JwtPayload, id: string, newPrice: number, ownerCode?: string) {
    const apt = await this.prisma.appointment.findFirst({
      where: { id, companyId: user.company_id, deletedAt: null },
    });
    if (!apt) throw new NotFoundException('Запись не найдена');
    if (apt.status === 'paid' || apt.status === 'cancelled') {
      throw new BadRequestException('Запись в финальном статусе');
    }
    if (newPrice < 0) throw new BadRequestException('Неверная цена');

    if (user.role === 'admin' && newPrice < Number(apt.originalPrice)) {
      const company = await this.prisma.company.findUniqueOrThrow({ where: { id: user.company_id } });
      const code = ((company.settings as Record<string, unknown>) ?? {}).priceCode;
      if (!code || ownerCode !== code) {
        throw new ForbiddenException('Требуется код владельца для снижения цены');
      }
    }

    await this.prisma.$transaction([
      this.prisma.priceChange.create({
        data: {
          companyId: user.company_id,
          appointmentId: id,
          oldPrice: apt.price,
          newPrice: new Prisma.Decimal(newPrice),
          changedBy: user.name ?? user.role,
        },
      }),
      this.prisma.appointment.update({ where: { id }, data: { price: newPrice } }),
    ]);

    if (newPrice < Number(apt.originalPrice)) {
      await this.notifications.notify(
        user.company_id,
        'price_below_original',
        'Цена изменена ниже прайса',
        `Цена записи #${apt.code} изменена с ${apt.price} ₸ на ${newPrice} ₸ — ${user.name ?? ''}`,
      );
    }
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'price_change', entity: 'appointment', entityId: id,
      details: { oldPrice: Number(apt.price), newPrice },
    });
    return this.getById(user.company_id, id);
  }

  /** Перенос записи (drag-n-drop в шахматке) */
  async reschedule(user: JwtPayload, id: string, boxId: string, startAt: string) {
    const apt = await this.prisma.appointment.findFirst({
      where: { id, companyId: user.company_id, deletedAt: null },
      include: { service: true },
    });
    if (!apt) throw new NotFoundException('Запись не найдена');
    if (!['pending', 'confirmed'].includes(apt.status)) {
      throw new BadRequestException('Перенос доступен только до начала работ');
    }
    const start = new Date(startAt);
    const duration = apt.endAt.getTime() - apt.startAt.getTime();
    const end = new Date(start.getTime() + duration);
    await this.ensureNoOverlap(user.company_id, boxId, start, end, id);
    await this.prisma.appointment.update({
      where: { id },
      data: { boxId, startAt: start, endAt: end },
    });
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'reschedule', entity: 'appointment', entityId: id,
      details: { boxId, startAt },
    });
    return this.getById(user.company_id, id);
  }

  /** NPS от мастера после done */
  async masterNps(user: JwtPayload, id: string, score: number, comment?: string) {
    if (score < 1 || score > 5) throw new BadRequestException('Оценка 1–5');
    const apt = await this.prisma.appointment.findFirst({
      where: { id, companyId: user.company_id, deletedAt: null },
    });
    if (!apt) throw new NotFoundException('Запись не найдена');
    if (!['done', 'paid'].includes(apt.status)) {
      throw new BadRequestException('Оценка доступна после завершения');
    }
    return this.prisma.npsResponse.upsert({
      where: { appointmentId: id },
      update: { score, comment },
      create: {
        companyId: user.company_id,
        appointmentId: id,
        clientId: apt.clientId,
        employeeId: apt.employeeId,
        score,
        comment,
        source: 'master_interface',
      },
    });
  }
}
