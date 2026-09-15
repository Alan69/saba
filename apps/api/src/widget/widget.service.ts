import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CarSize } from '@prisma/client';
import Redis from 'ioredis';
import { customAlphabet, nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';
import { dayRangeUtc, localTimeToUtc, weekdayKey } from '../common/time';
import { resolveCarSizes } from '../common/car-sizes';

const genCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
const SLOT_STEP_MIN = 30;
const RESERVATION_TTL_SEC = 600;

interface WorkingDay {
  enabled: boolean;
  start: string;
  end: string;
}

@Injectable()
export class WidgetService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private async companyBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({ where: { slug } });
    if (!company || company.deletedAt) throw new NotFoundException('Компания не найдена');
    return company;
  }

  async publicInfo(slug: string) {
    const company = await this.companyBySlug(slug);
    const services = await this.prisma.service.findMany({
      where: { companyId: company.id, deletedAt: null, active: true },
      select: { id: true, name: true, category: true, durationMin: true, price: true, priceBySize: true },
      orderBy: { createdAt: 'asc' },
    });
    const employees = await this.prisma.employee.findMany({
      where: { companyId: company.id, deletedAt: null, active: true, isBookable: true },
      select: { id: true, name: true, jobTitle: true, avatarUrl: true, bio: true },
      orderBy: { createdAt: 'asc' },
    });
    // рейтинги мастеров из NPS-ответов (оценка 1–5)
    const ratings = await this.prisma.npsResponse.groupBy({
      by: ['employeeId'],
      where: { companyId: company.id, employeeId: { in: employees.map((e) => e.id) } },
      _avg: { score: true },
      _count: { _all: true },
    });
    const ratingMap = new Map(ratings.map((r) => [r.employeeId, { avg: r._avg.score, count: r._count._all }]));
    const specialists = employees.map((e) => {
      const r = ratingMap.get(e.id);
      return {
        ...e,
        rating: r?.avg != null ? Math.round(r.avg * 10) / 10 : null,
        reviewCount: r?.count ?? 0,
      };
    });
    const priceRows = await this.prisma.employeeServicePrice.findMany({
      where: { companyId: company.id },
      select: { employeeId: true, serviceId: true, price: true },
    });
    const employeePrices = priceRows.map((p) => ({
      employeeId: p.employeeId,
      serviceId: p.serviceId,
      price: Number(p.price),
    }));
    const settings = (company.settings as Record<string, unknown>) ?? {};
    return {
      name: company.name,
      slug: company.slug,
      businessType: company.businessType,
      specialists,
      employeePrices,
      address: company.address,
      phone: company.phone,
      accentColor: company.accentColor,
      workingHours: company.workingHours,
      termsUrl: (settings.termsUrl as string) ?? null,
      privacyUrl: (settings.privacyUrl as string) ?? null,
      poweredBy: company.plan === 'light' ? true : !(settings.hidePoweredBy === true),
      carSizes: resolveCarSizes(company.settings).filter((s) => s.enabled),
      services,
    };
  }

  /**
   * Свободные слоты на дату: по активным боксам, шаг 30 мин.
   * Если задан employeeId — окно = график мастера ∩ часы компании, плюс
   * исключаем времена, когда этот мастер уже занят.
   */
  async slots(slug: string, dateISO: string, serviceIds: string[], employeeId?: string) {
    const company = await this.companyBySlug(slug);
    const services = await this.loadServices(company.id, serviceIds);
    const totalDurationMin = services.reduce((sum, s) => sum + s.durationMin, 0);

    const wh = (company.workingHours as unknown as Record<string, WorkingDay>) ?? {};
    const { start: dayStart } = dayRangeUtc(dateISO, company.timezone);
    const weekday = weekdayKey(dayStart, company.timezone);
    const day = wh[weekday];
    if (!day?.enabled) return { date: dateISO, slots: [] };

    let openMs = localTimeToUtc(dateISO, day.start, company.timezone).getTime();
    let closeMs = localTimeToUtc(dateISO, day.end, company.timezone).getTime();

    // окно мастера пересекаем с окном компании
    if (employeeId) {
      const emp = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId: company.id, deletedAt: null, active: true, isBookable: true },
      });
      if (!emp) throw new BadRequestException('Специалист не найден');
      const win = await this.employeeWindow(employeeId, weekday);
      if (win === 'off') return { date: dateISO, slots: [] };
      if (win) {
        openMs = Math.max(openMs, localTimeToUtc(dateISO, win.start, company.timezone).getTime());
        closeMs = Math.min(closeMs, localTimeToUtc(dateISO, win.end, company.timezone).getTime());
      }
      if (openMs >= closeMs) return { date: dateISO, slots: [] };
    }

    const boxes = await this.prisma.box.findMany({
      where: { companyId: company.id, deletedAt: null, status: 'active' },
      orderBy: { sortOrder: 'asc' },
    });
    if (!boxes.length) return { date: dateISO, slots: [] };

    const { start, end } = dayRangeUtc(dateISO, company.timezone);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId: company.id,
        startAt: { gte: start, lt: end },
        deletedAt: null,
        status: { in: ['pending', 'confirmed', 'in_progress', 'done', 'paid'] },
      },
      select: { boxId: true, employeeId: true, startAt: true, endAt: true },
    });

    const durMs = totalDurationMin * 60_000;
    const now = Date.now();

    const slots: { startAt: string; time: string; boxIds: string[] }[] = [];
    for (let t = openMs; t + durMs <= closeMs; t += SLOT_STEP_MIN * 60_000) {
      if (t < now) continue;
      const slotEnd = t + durMs;
      // мастер занят в этом интервале?
      if (employeeId && appointments.some(
        (a) => a.employeeId === employeeId && a.startAt.getTime() < slotEnd && a.endAt.getTime() > t,
      )) continue;

      const freeBoxes: string[] = [];
      for (const box of boxes) {
        const busy = appointments.some(
          (a) => a.boxId === box.id && a.startAt.getTime() < slotEnd && a.endAt.getTime() > t,
        );
        if (busy) continue;
        const reserved = await this.redis.exists(this.rkey(company.id, box.id, t));
        if (reserved) continue;
        freeBoxes.push(box.id);
      }
      if (freeBoxes.length) {
        const time = new Intl.DateTimeFormat('ru-RU', {
          timeZone: company.timezone, hour: '2-digit', minute: '2-digit',
        }).format(new Date(t));
        slots.push({ startAt: new Date(t).toISOString(), time, boxIds: freeBoxes });
      }
    }
    return { date: dateISO, slots };
  }

  /**
   * Окно работы мастера на день недели:
   * - запись графика есть и enabled → {start,end}
   * - запись есть, но выключена → 'off'
   * - графика нет вовсе → null (используем часы компании)
   * - график настроен, но не на этот день → 'off' (выходной)
   */
  private async employeeWindow(
    employeeId: string,
    weekday: string,
  ): Promise<'off' | { start: string; end: string } | null> {
    const sched = await this.prisma.employeeSchedule.findUnique({
      where: { employeeId_weekday: { employeeId, weekday } },
    });
    if (sched) return sched.enabled ? { start: sched.start, end: sched.end } : 'off';
    const any = await this.prisma.employeeSchedule.count({ where: { employeeId } });
    return any === 0 ? null : 'off';
  }

  /** Загружает и валидирует услуги по id, сохраняя порядок выбора. */
  private async loadServices(companyId: string, serviceIds: string[]) {
    const ids = [...new Set(serviceIds)].filter(Boolean);
    if (!ids.length) throw new BadRequestException('Не выбрана услуга');
    const found = await this.prisma.service.findMany({
      where: { id: { in: ids }, companyId, deletedAt: null, active: true },
    });
    if (found.length !== ids.length) throw new BadRequestException('Услуга не найдена');
    const byId = new Map(found.map((s) => [s.id, s]));
    return ids.map((id) => byId.get(id)!);
  }

  private rkey(companyId: string, boxId: string, startMs: number) {
    return `reserve:${companyId}:${boxId}:${startMs}`;
  }

  /** Бронь слота: Redis SETNX TTL 600 (ТЗ 6.3) + проверка занятости в БД */
  async reserve(slug: string, body: { startAt: string; serviceId?: string; serviceIds?: string[]; boxId?: string; employeeId?: string }) {
    const company = await this.companyBySlug(slug);
    const start = new Date(body.startAt);
    if (Number.isNaN(start.getTime())) throw new BadRequestException('Неверное время');

    const ids = body.serviceIds?.length ? body.serviceIds : body.serviceId ? [body.serviceId] : [];
    const services = await this.loadServices(company.id, ids);
    const totalDurationMin = services.reduce((sum, s) => sum + s.durationMin, 0);
    const end = new Date(start.getTime() + totalDurationMin * 60_000);

    const boxes = body.boxId
      ? await this.prisma.box.findMany({ where: { id: body.boxId, companyId: company.id, status: 'active', deletedAt: null } })
      : await this.prisma.box.findMany({ where: { companyId: company.id, status: 'active', deletedAt: null }, orderBy: { sortOrder: 'asc' } });

    // боксы, занятые существующими записями в этом интервале
    const busy = await this.prisma.appointment.findMany({
      where: {
        companyId: company.id,
        deletedAt: null,
        status: { in: ['pending', 'confirmed', 'in_progress', 'done', 'paid'] },
        startAt: { lt: end },
        endAt: { gt: start },
      },
      select: { boxId: true },
    });
    const busyIds = new Set(busy.map((b) => b.boxId));

    if (body.employeeId) {
      const empBusy = await this.prisma.appointment.findFirst({
        where: {
          companyId: company.id,
          employeeId: body.employeeId,
          deletedAt: null,
          status: { in: ['pending', 'confirmed', 'in_progress', 'done', 'paid'] },
          startAt: { lt: end },
          endAt: { gt: start },
        },
        select: { id: true },
      });
      if (empBusy) throw new ConflictException('Специалист занят в это время');
    }

    const token = nanoid(24);
    for (const box of boxes) {
      if (busyIds.has(box.id)) continue;
      const key = this.rkey(company.id, box.id, start.getTime());
      const ok = await this.redis.set(key, token, 'EX', RESERVATION_TTL_SEC, 'NX');
      if (ok === 'OK') {
        return {
          reservationToken: token,
          boxId: box.id,
          startAt: start.toISOString(),
          ttlSec: RESERVATION_TTL_SEC,
        };
      }
    }
    throw new ConflictException('Слот уже занят. Выберите другое время');
  }

  /** Оформление записи из виджета */
  async book(
    slug: string,
    body: {
      reservationToken?: string;
      boxId: string;
      startAt: string;
      serviceId?: string;
      serviceIds?: string[];
      phone: string;
      name?: string;
      email?: string;
      carBrand?: string;
      carPlate?: string;
      carSize?: CarSize;
      waConsent?: boolean;
      comment?: string;
      reminderMinutes?: number;
      employeeId?: string;
    },
  ) {
    const company = await this.companyBySlug(slug);
    if (company.mode !== 'active') {
      throw new ConflictException('Онлайн-запись временно недоступна');
    }
    const serviceIds = body.serviceIds?.length ? body.serviceIds : body.serviceId ? [body.serviceId] : [];
    const services = await this.loadServices(company.id, serviceIds);
    const primary = services[0];
    const totalDurationMin = services.reduce((sum, s) => sum + s.durationMin, 0);
    if (!/^\+?[0-9]{10,15}$/.test(body.phone)) throw new BadRequestException('Неверный телефон');
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      throw new BadRequestException('Неверный e-mail');
    }

    let employeeId: string | null = null;
    if (body.employeeId) {
      const emp = await this.prisma.employee.findFirst({
        where: { id: body.employeeId, companyId: company.id, deletedAt: null, active: true, isBookable: true },
        select: { id: true },
      });
      if (!emp) throw new BadRequestException('Специалист не найден');
      employeeId = emp.id;
    }

    const start = new Date(body.startAt);
    const end = new Date(start.getTime() + totalDurationMin * 60_000);

    // проверка резерва (если есть токен — он должен совпадать)
    const key = this.rkey(company.id, body.boxId, start.getTime());
    if (body.reservationToken) {
      const stored = await this.redis.get(key);
      if (stored && stored !== body.reservationToken) {
        throw new ConflictException('Слот забронирован другим клиентом');
      }
    }

    // клиент
    const client = await this.prisma.client.upsert({
      where: { companyId_phone: { companyId: company.id, phone: body.phone } },
      update: {
        name: body.name ?? undefined,
        email: body.email ?? undefined,
        waConsent: body.waConsent ?? undefined,
        deletedAt: null,
      },
      create: {
        companyId: company.id,
        phone: body.phone,
        name: body.name,
        email: body.email,
        waConsent: body.waConsent ?? false,
      },
    });
    let clientCarId: string | null = null;
    if (body.carBrand) {
      const car = await this.prisma.clientCar.create({
        data: {
          companyId: company.id,
          clientId: client.id,
          brand: body.carBrand,
          plateNumber: body.carPlate,
          size: body.carSize ?? 'M',
        },
      });
      clientCarId = car.id;
    }

    // цена по каждой услуге: размер авто, затем переопределение по мастеру (Этап 3)
    const overrides = employeeId
      ? await this.prisma.employeeServicePrice.findMany({
          where: { employeeId, serviceId: { in: services.map((s) => s.id) } },
          select: { serviceId: true, price: true },
        })
      : [];
    const overrideMap = new Map(overrides.map((o) => [o.serviceId, Number(o.price)]));
    const lines = services.map((s) => {
      const bySize = (s.priceBySize as Record<string, number> | null) ?? null;
      const base = body.carSize && bySize?.[body.carSize] != null ? Number(bySize[body.carSize]) : Number(s.price);
      return { serviceId: s.id, durationMin: s.durationMin, price: overrideMap.get(s.id) ?? base };
    });
    const price = lines.reduce((sum, l) => sum + l.price, 0);

    // защита от race: пере-проверка пересечений + ловим конфликт
    const overlap = await this.prisma.appointment.findFirst({
      where: {
        companyId: company.id,
        boxId: body.boxId,
        deletedAt: null,
        status: { in: ['pending', 'confirmed', 'in_progress', 'done', 'paid'] },
        startAt: { lt: end },
        endAt: { gt: start },
      },
    });
    if (overlap) throw new ConflictException('Слот уже занят');

    if (employeeId) {
      const empOverlap = await this.prisma.appointment.findFirst({
        where: {
          companyId: company.id,
          employeeId,
          deletedAt: null,
          status: { in: ['pending', 'confirmed', 'in_progress', 'done', 'paid'] },
          startAt: { lt: end },
          endAt: { gt: start },
        },
        select: { id: true },
      });
      if (empOverlap) throw new ConflictException('Специалист занят в это время');
    }

    let appointment;
    try {
      appointment = await this.prisma.appointment.create({
        data: {
          companyId: company.id,
          boxId: body.boxId,
          clientId: client.id,
          clientCarId,
          employeeId,
          serviceId: primary.id,
          code: genCode(),
          startAt: start,
          endAt: end,
          status: 'pending',
          price,
          originalPrice: price,
          source: 'widget',
          comment: body.comment?.trim() || null,
          reminderMinutes: body.reminderMinutes ?? null,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Слот уже занят');
      throw e;
    }

    // полный список услуг записи (Этап 5)
    await this.prisma.appointmentService.createMany({
      data: lines.map((l) => ({
        appointmentId: appointment.id,
        serviceId: l.serviceId,
        price: l.price,
        durationMin: l.durationMin,
      })),
    });

    await this.redis.del(key);
    await this.prisma.systemNotification.create({
      data: {
        companyId: company.id,
        type: 'new_booking',
        title: 'Новая онлайн-запись',
        message: `${body.name ?? body.phone} записался через виджет на ${new Intl.DateTimeFormat('ru-RU', { timeZone: company.timezone, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(start)}`,
      },
    });

    return { code: appointment.code, status: appointment.status, startAt: appointment.startAt };
  }

  async bookingStatus(slug: string, code: string) {
    const company = await this.companyBySlug(slug);
    const apt = await this.prisma.appointment.findFirst({
      where: { code, companyId: company.id },
      include: {
        service: { select: { name: true, durationMin: true } },
        box: { select: { name: true } },
        employee: { select: { name: true } },
      },
    });
    if (!apt) throw new NotFoundException('Запись не найдена');
    return {
      code: apt.code,
      status: apt.status,
      startAt: apt.startAt,
      endAt: apt.endAt,
      price: apt.price,
      service: apt.service?.name,
      box: apt.box?.name,
      master: apt.employee?.name,
      companyName: company.name,
    };
  }

  /** Отмена записи клиентом по коду (упрощённый cancel_link) */
  async cancelByCode(slug: string, code: string) {
    const company = await this.companyBySlug(slug);
    const apt = await this.prisma.appointment.findFirst({
      where: { code, companyId: company.id },
    });
    if (!apt) throw new NotFoundException('Запись не найдена');
    if (!['pending', 'confirmed'].includes(apt.status)) {
      throw new BadRequestException('Запись уже выполняется — отмена невозможна');
    }
    if (apt.startAt.getTime() - Date.now() < 60 * 60_000) {
      throw new BadRequestException('Отмена доступна не позднее чем за час до записи');
    }
    await this.prisma.appointment.update({
      where: { id: apt.id },
      data: { status: 'cancelled', cancelReason: 'client_via_link', cancelledBy: 'client' },
    });
    await this.prisma.systemNotification.create({
      data: {
        companyId: company.id,
        type: 'client_cancel',
        title: 'Клиент отменил запись',
        message: `Запись #${apt.code} отменена клиентом`,
      },
    });
    return { ok: true };
  }
}
