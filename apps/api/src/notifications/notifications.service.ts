import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(companyId: string, type: string, title: string, message: string, userId?: string) {
    await this.prisma.systemNotification.create({
      data: { companyId, userId: userId ?? null, type, title, message },
    });
  }

  list(companyId: string) {
    return this.prisma.systemNotification.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(companyId: string, id: string) {
    await this.prisma.systemNotification.updateMany({
      where: { id, companyId },
      data: { isRead: true },
    });
    return { ok: true };
  }

  async markAllRead(companyId: string) {
    await this.prisma.systemNotification.updateMany({
      where: { companyId, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }
}
