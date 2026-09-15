import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppointmentsCron {
  private readonly logger = new Logger(AppointmentsCron.name);

  constructor(private readonly prisma: PrismaService) {}

  /** confirmed + 30 мин после начала → no_show (ТЗ 8.5, каждые 15 мин) */
  @Cron('*/15 * * * *')
  async markNoShow() {
    const threshold = new Date(Date.now() - 30 * 60_000);
    const { count } = await this.prisma.appointment.updateMany({
      where: { status: 'confirmed', startAt: { lt: threshold }, deletedAt: null },
      data: { status: 'no_show' },
    });
    if (count > 0) this.logger.log(`no_show: ${count} записей`);
  }

  /** Подписка истекла → read_only (ежедневно 09:00) */
  @Cron('0 9 * * *')
  async planExpiry() {
    const { count } = await this.prisma.company.updateMany({
      where: { mode: 'active', planExpiresAt: { lt: new Date() }, isTrial: false },
      data: { mode: 'read_only' },
    });
    // триал истёк → переход на Light, данные сохраняются (ТЗ 2.3)
    const trialExpired = await this.prisma.company.findMany({
      where: { isTrial: true, planExpiresAt: { lt: new Date() } },
    });
    for (const c of trialExpired) {
      await this.prisma.company.update({
        where: { id: c.id },
        data: { plan: 'light', isTrial: false, planExpiresAt: null },
      });
      await this.prisma.systemNotification.create({
        data: {
          companyId: c.id,
          type: 'trial_ended',
          title: 'Триал завершён',
          message: 'Пробный период закончился. Вы переведены на план Light. Business-функции скрыты.',
        },
      });
    }
    if (count > 0 || trialExpired.length > 0) {
      this.logger.log(`read_only: ${count}, trial→light: ${trialExpired.length}`);
    }
  }

  /** Предупреждение о конце триала за 7 дней (ежедневно 10:00) */
  @Cron('0 10 * * *')
  async trialWarning() {
    const in7days = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const in6days = new Date(Date.now() + 6 * 24 * 3600 * 1000);
    const companies = await this.prisma.company.findMany({
      where: { isTrial: true, planExpiresAt: { gte: in6days, lt: in7days } },
    });
    for (const c of companies) {
      await this.prisma.systemNotification.create({
        data: {
          companyId: c.id,
          type: 'trial_warning',
          title: 'Триал заканчивается',
          message: 'Пробный период заканчивается через 7 дней',
        },
      });
    }
  }
}
