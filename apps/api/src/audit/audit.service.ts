import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntryInput {
  companyId: string;
  userId?: string | null;
  actorName: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntryInput) {
    await this.prisma.auditLog.create({
      data: {
        companyId: entry.companyId,
        userId: entry.userId ?? null,
        actorName: entry.actorName,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        details: entry.details ?? {},
      },
    });
  }

  list(companyId: string, limit = 200) {
    return this.prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }
}
