import { Injectable, NotFoundException } from '@nestjs/common';
import { CarSize, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../common/auth.types';

export interface ClientInput {
  phone?: string;
  name?: string;
  waConsent?: boolean;
  waOptOut?: boolean;
  notes?: string;
}

export interface CarInput {
  brand: string;
  plateNumber?: string;
  size?: CarSize;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, 2)}***${phone.slice(-4)}`;
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: JwtPayload, search?: string, segment?: string) {
    const where: Prisma.ClientWhereInput = {
      companyId: user.company_id,
      deletedAt: null,
      ...(segment ? { rfmSegment: segment } : {}),
      ...(search
        ? {
            OR: [
              { phone: { contains: search } },
              { name: { contains: search, mode: 'insensitive' } },
              { cars: { some: { plateNumber: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const clients = await this.prisma.client.findMany({
      where,
      include: { cars: { where: { deletedAt: null } } },
      orderBy: [{ lastVisitAt: { sort: 'desc', nulls: 'last' } }],
      take: 500,
    });
    // admin видит телефон замаскированным (ТЗ 7)
    if (user.role === 'admin') {
      return clients.map((c) => ({ ...c, phone: maskPhone(c.phone) }));
    }
    return clients;
  }

  async findByPhone(user: JwtPayload, phone: string) {
    const client = await this.prisma.client.findFirst({
      where: { companyId: user.company_id, phone, deletedAt: null },
      include: {
        cars: { where: { deletedAt: null } },
        appointments: {
          orderBy: { startAt: 'desc' },
          take: 5,
          include: { service: true },
        },
      },
    });
    return client ?? null;
  }

  async get(user: JwtPayload, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId: user.company_id, deletedAt: null },
      include: {
        cars: { where: { deletedAt: null } },
        appointments: {
          orderBy: { startAt: 'desc' },
          take: 50,
          include: { service: true, employee: true, box: true },
        },
        npsResponses: { orderBy: { respondedAt: 'desc' }, take: 10 },
      },
    });
    if (!client) throw new NotFoundException('Клиент не найден');
    if (user.role === 'admin') return { ...client, phone: maskPhone(client.phone) };
    return client;
  }

  async create(user: JwtPayload, input: ClientInput & { phone: string; cars?: CarInput[] }) {
    const client = await this.prisma.client.upsert({
      where: { companyId_phone: { companyId: user.company_id, phone: input.phone } },
      update: {
        name: input.name ?? undefined,
        waConsent: input.waConsent ?? undefined,
        notes: input.notes ?? undefined,
        deletedAt: null,
      },
      create: {
        companyId: user.company_id,
        phone: input.phone,
        name: input.name,
        waConsent: input.waConsent ?? false,
        notes: input.notes,
      },
    });
    if (input.cars?.length) {
      for (const car of input.cars) {
        await this.prisma.clientCar.create({
          data: {
            companyId: user.company_id,
            clientId: client.id,
            brand: car.brand,
            plateNumber: car.plateNumber,
            size: car.size ?? 'M',
          },
        });
      }
    }
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'create', entity: 'client', entityId: client.id,
    });
    return this.get(user, client.id);
  }

  async update(user: JwtPayload, id: string, input: ClientInput) {
    await this.prisma.client.findFirstOrThrow({ where: { id, companyId: user.company_id } });
    const client = await this.prisma.client.update({ where: { id }, data: input });
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'update', entity: 'client', entityId: id, details: { fields: Object.keys(input) },
    });
    return client;
  }

  async addCar(user: JwtPayload, clientId: string, car: CarInput) {
    await this.prisma.client.findFirstOrThrow({ where: { id: clientId, companyId: user.company_id } });
    return this.prisma.clientCar.create({
      data: {
        companyId: user.company_id,
        clientId,
        brand: car.brand,
        plateNumber: car.plateNumber,
        size: car.size ?? 'M',
      },
    });
  }

  async removeCar(user: JwtPayload, clientId: string, carId: string) {
    await this.prisma.clientCar.findFirstOrThrow({
      where: { id: carId, clientId, companyId: user.company_id },
    });
    await this.prisma.clientCar.update({ where: { id: carId }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
