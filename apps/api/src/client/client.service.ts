import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CarSize } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';
import { ClientPrincipal } from './client.guard';

const PHONE_RE = /^\+?[0-9]{10,15}$/;
const OTP_TTL_SEC = 600; // код живёт 10 минут
const OTP_COOLDOWN_SEC = 30; // антиспам между отправками (в проде по ТЗ — 5 мин)

function normalizePhone(phone: string): string {
  const clean = phone.replace(/[^\d+]/g, '');
  if (clean.startsWith('+')) return clean;
  return `+7${clean.replace(/^[78]/, '')}`;
}

@Injectable()
export class ClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private async companyBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({ where: { slug } });
    if (!company || company.deletedAt) throw new NotFoundException('Мойка не найдена');
    return company;
  }

  /**
   * Отправка OTP. WABA в Phase 1 нет — код возвращается в ответе (devCode)
   * и параллельно его можно отдать через системный WhatsApp-номер Saba в проде.
   */
  async sendOtp(slug: string, phoneRaw: string) {
    const company = await this.companyBySlug(slug);
    if (!PHONE_RE.test(phoneRaw.replace(/[^\d+]/g, ''))) {
      throw new BadRequestException('Неверный формат телефона');
    }
    const phone = normalizePhone(phoneRaw);
    const cdKey = `otp:cd:${company.id}:${phone}`;
    if (await this.redis.exists(cdKey)) {
      throw new BadRequestException('Код уже отправлен. Повторите через минуту');
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.redis.set(`otp:${company.id}:${phone}`, code, 'EX', OTP_TTL_SEC);
    await this.redis.set(cdKey, '1', 'EX', OTP_COOLDOWN_SEC);
    // dev-стаб: без WABA код возвращаем прямо в ответ для демо
    return { sent: true, devCode: code, ttlSec: OTP_TTL_SEC };
  }

  async verifyOtp(slug: string, phoneRaw: string, code: string) {
    const company = await this.companyBySlug(slug);
    const phone = normalizePhone(phoneRaw);
    const key = `otp:${company.id}:${phone}`;
    const stored = await this.redis.get(key);
    if (!stored) throw new BadRequestException('Код истёк. Запросите новый');
    if (stored !== String(code).trim()) throw new BadRequestException('Неверный код');
    await this.redis.del(key);

    // создаём/находим клиента этой мойки по телефону
    const client = await this.prisma.client.upsert({
      where: { companyId_phone: { companyId: company.id, phone } },
      update: { deletedAt: null },
      create: { companyId: company.id, phone },
    });

    const token = await this.jwt.signAsync(
      { sub: client.id, company_id: company.id, type: 'client' },
      { expiresIn: '30d' },
    );
    return {
      token,
      client: { id: client.id, name: client.name, phone: client.phone },
      company: { name: company.name, slug: company.slug, accentColor: company.accentColor },
    };
  }

  async profile(principal: ClientPrincipal) {
    const client = await this.prisma.client.findFirst({
      where: { id: principal.clientId, companyId: principal.companyId, deletedAt: null },
      include: { cars: { where: { deletedAt: null } } },
    });
    if (!client) throw new NotFoundException('Клиент не найден');

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: principal.companyId },
    });

    const appts = await this.prisma.appointment.findMany({
      where: { clientId: client.id, companyId: principal.companyId, deletedAt: null },
      include: {
        service: { select: { name: true } },
        employee: { select: { name: true } },
        box: { select: { name: true } },
        clientCar: { select: { brand: true } },
      },
      orderBy: { startAt: 'desc' },
    });

    const now = Date.now();
    const isUpcoming = (a: (typeof appts)[number]) =>
      ['pending', 'confirmed', 'in_progress'].includes(a.status) && a.startAt.getTime() > now;

    const shape = (a: (typeof appts)[number]) => ({
      id: a.id,
      code: a.code,
      status: a.status,
      startAt: a.startAt,
      endAt: a.endAt,
      price: a.price,
      service: a.service?.name,
      master: a.employee?.name,
      box: a.box?.name,
      car: a.clientCar?.brand,
      cancellable:
        ['pending', 'confirmed'].includes(a.status) &&
        a.startAt.getTime() - now > 60 * 60_000,
    });

    return {
      client: {
        id: client.id,
        name: client.name,
        phone: client.phone,
        visitsCount: client.visitsCount,
        totalSpent: client.totalSpent,
      },
      company: { name: company.name, slug: company.slug, accentColor: company.accentColor },
      cars: client.cars.map((c) => ({
        id: c.id,
        brand: c.brand,
        plateNumber: c.plateNumber,
        size: c.size,
      })),
      upcoming: appts.filter(isUpcoming).reverse().map(shape),
      history: appts.filter((a) => !isUpcoming(a)).map(shape),
    };
  }

  async cancelAppointment(principal: ClientPrincipal, appointmentId: string) {
    const appt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clientId: principal.clientId, companyId: principal.companyId, deletedAt: null },
    });
    if (!appt) throw new NotFoundException('Запись не найдена');
    if (!['pending', 'confirmed'].includes(appt.status)) {
      throw new BadRequestException('Эту запись уже нельзя отменить');
    }
    if (appt.startAt.getTime() - Date.now() < 60 * 60_000) {
      throw new ForbiddenException('Отмена доступна не позднее чем за час до записи');
    }
    await this.prisma.appointment.update({
      where: { id: appt.id },
      data: { status: 'cancelled', cancelReason: 'client_portal', cancelledBy: 'client' },
    });
    await this.prisma.systemNotification.create({
      data: {
        companyId: principal.companyId,
        type: 'client_cancel',
        title: 'Клиент отменил запись',
        message: `Запись #${appt.code} отменена клиентом через личный кабинет`,
      },
    });
    return { ok: true };
  }

  async addCar(principal: ClientPrincipal, body: { brand: string; plateNumber?: string; size?: CarSize }) {
    if (!body.brand?.trim()) throw new BadRequestException('Укажите марку авто');
    return this.prisma.clientCar.create({
      data: {
        companyId: principal.companyId,
        clientId: principal.clientId,
        brand: body.brand.trim(),
        plateNumber: body.plateNumber,
        size: body.size ?? 'M',
      },
      select: { id: true, brand: true, plateNumber: true, size: true },
    });
  }

  async updateCar(
    principal: ClientPrincipal,
    carId: string,
    body: { brand?: string; plateNumber?: string; size?: CarSize },
  ) {
    await this.prisma.clientCar.findFirstOrThrow({
      where: { id: carId, clientId: principal.clientId, companyId: principal.companyId },
    });
    return this.prisma.clientCar.update({
      where: { id: carId },
      data: { brand: body.brand, plateNumber: body.plateNumber, size: body.size },
      select: { id: true, brand: true, plateNumber: true, size: true },
    });
  }

  async deleteCar(principal: ClientPrincipal, carId: string) {
    await this.prisma.clientCar.findFirstOrThrow({
      where: { id: carId, clientId: principal.clientId, companyId: principal.companyId },
    });
    await this.prisma.clientCar.update({ where: { id: carId }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
