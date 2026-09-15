import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReminderSender } from './reminder-sender';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: ReminderSender,
  ) {}

  /**
   * Находит записи, которым пора напомнить (Этап 6):
   * reminderMinutes задан, ещё не отправлено, запись активна и наступает
   * в пределах окна напоминания. Отправляет через подключённый канал и
   * проставляет reminderSentAt, чтобы не отправить повторно.
   */
  async dispatchDue(now: Date = new Date()): Promise<number> {
    const candidates = await this.prisma.appointment.findMany({
      where: {
        reminderMinutes: { not: null, gt: 0 },
        reminderSentAt: null,
        deletedAt: null,
        status: { in: ['pending', 'confirmed'] },
        startAt: { gt: now },
      },
      select: {
        id: true,
        code: true,
        startAt: true,
        reminderMinutes: true,
        company: { select: { name: true } },
        service: { select: { name: true } },
        client: { select: { name: true, phone: true, email: true } },
      },
    });

    const due = candidates.filter(
      (a) => a.startAt.getTime() - (a.reminderMinutes ?? 0) * 60_000 <= now.getTime(),
    );

    let sent = 0;
    for (const a of due) {
      try {
        await this.sender.send({
          appointmentId: a.id,
          code: a.code,
          startAt: a.startAt,
          companyName: a.company.name,
          serviceName: a.service?.name ?? null,
          clientName: a.client?.name ?? null,
          phone: a.client?.phone ?? null,
          email: a.client?.email ?? null,
        });
        await this.prisma.appointment.update({
          where: { id: a.id },
          data: { reminderSentAt: now },
        });
        sent++;
      } catch (e) {
        this.logger.error(`Не удалось отправить напоминание ${a.code}: ${String(e)}`);
      }
    }
    if (sent > 0) this.logger.log(`Отправлено напоминаний: ${sent}`);
    return sent;
  }
}
