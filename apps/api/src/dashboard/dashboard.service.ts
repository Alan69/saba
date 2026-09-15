import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_LIMITS } from '../common/plan-limits';
import { dayRangeUtc, weekdayKey } from '../common/time';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** «Сегодня» — доступно на всех планах (ТЗ 6.12) */
  async today(companyId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: company.timezone }).format(new Date());
    const { start, end } = dayRangeUtc(todayISO, company.timezone);
    const yesterdayISO = new Intl.DateTimeFormat('en-CA', { timeZone: company.timezone })
      .format(new Date(Date.now() - 24 * 3600 * 1000));
    const yRange = dayRangeUtc(yesterdayISO, company.timezone);

    const [todayAppts, yesterdayPaid] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { companyId, startAt: { gte: start, lt: end }, deletedAt: null },
        select: { status: true, price: true, paymentMethod: true, startAt: true, endAt: true },
      }),
      this.prisma.appointment.aggregate({
        where: {
          companyId, status: 'paid', deletedAt: null,
          startAt: { gte: yRange.start, lt: yRange.end },
        },
        _sum: { price: true },
      }),
    ]);

    const paid = todayAppts.filter((a) => a.status === 'paid');
    const revenue = paid.reduce((s, a) => s + Number(a.price), 0);
    const revenueYesterday = Number(yesterdayPaid._sum.price ?? 0);
    const byMethod: Record<string, number> = {};
    for (const a of paid) {
      const m = a.paymentMethod ?? 'cash';
      byMethod[m] = (byMethod[m] ?? 0) + Number(a.price);
    }
    const noShows = todayAppts.filter((a) => a.status === 'no_show');
    const lostRevenue = noShows.reduce((s, a) => s + Number(a.price), 0);

    // загрузка боксов: занятые часы / рабочие часы
    const boxes = await this.prisma.box.count({
      where: { companyId, deletedAt: null, status: 'active' },
    });
    const wh = (company.workingHours as Record<string, { enabled: boolean; start: string; end: string }>) ?? {};
    const day = wh[weekdayKey(start, company.timezone)];
    let utilization = 0;
    if (day?.enabled && boxes > 0) {
      const [sh, sm] = day.start.split(':').map(Number);
      const [eh, em] = day.end.split(':').map(Number);
      const workHours = eh + em / 60 - sh - sm / 60;
      const busyHours = todayAppts
        .filter((a) => !['cancelled', 'no_show'].includes(a.status))
        .reduce((s, a) => s + (a.endAt.getTime() - a.startAt.getTime()) / 3_600_000, 0);
      utilization = Math.min(100, Math.round((busyHours / (workHours * boxes)) * 100));
    }

    return {
      date: todayISO,
      revenue,
      revenueYesterday,
      revenueTrend: revenueYesterday > 0 ? Math.round(((revenue - revenueYesterday) / revenueYesterday) * 100) : null,
      byMethod,
      appointmentsCount: todayAppts.filter((a) => !['cancelled'].includes(a.status)).length,
      noShowCount: noShows.length,
      lostRevenue,
      utilization,
    };
  }

  /** Полная аналитика — только Business (ТЗ 2.1) */
  async analytics(companyId: string, period: 'week' | 'month' = 'week') {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    if (!PLAN_LIMITS[company.plan].features.fullAnalytics) {
      throw new ForbiddenException('Функция доступна в Business. Обновить →');
    }
    const days = period === 'week' ? 7 : 30;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const prevSince = new Date(since.getTime() - days * 24 * 3600 * 1000);

    const [current, previous] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { companyId, status: 'paid', deletedAt: null, startAt: { gte: since } },
        include: { service: { select: { name: true } }, employee: { select: { id: true, name: true } } },
      }),
      this.prisma.appointment.findMany({
        where: { companyId, status: 'paid', deletedAt: null, startAt: { gte: prevSince, lt: since } },
        select: { startAt: true, price: true },
      }),
    ]);

    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: company.timezone });
    const byDay: Record<string, number> = {};
    for (const a of current) {
      const d = fmt.format(a.startAt);
      byDay[d] = (byDay[d] ?? 0) + Number(a.price);
    }
    const prevByDay: Record<string, number> = {};
    for (const a of previous) {
      const d = fmt.format(a.startAt);
      prevByDay[d] = (prevByDay[d] ?? 0) + Number(a.price);
    }

    const byService: Record<string, { name: string; revenue: number; count: number }> = {};
    const byMaster: Record<string, { name: string; revenue: number; count: number }> = {};
    for (const a of current) {
      const sName = a.service?.name ?? '—';
      byService[sName] = byService[sName] ?? { name: sName, revenue: 0, count: 0 };
      byService[sName].revenue += Number(a.price);
      byService[sName].count += 1;
      if (a.employee) {
        byMaster[a.employee.id] = byMaster[a.employee.id] ?? { name: a.employee.name, revenue: 0, count: 0 };
        byMaster[a.employee.id].revenue += Number(a.price);
        byMaster[a.employee.id].count += 1;
      }
    }

    // спящие клиенты: 30+ дней без визита
    const sleeping = await this.prisma.client.count({
      where: {
        companyId, deletedAt: null,
        lastVisitAt: { lt: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
      },
    });

    return {
      period,
      revenueByDay: byDay,
      prevRevenueByDay: prevByDay,
      topServices: Object.values(byService).sort((a, b) => b.revenue - a.revenue).slice(0, 3),
      topMasters: Object.values(byMaster).sort((a, b) => b.revenue - a.revenue).slice(0, 3),
      sleepingClients: sleeping,
    };
  }
}
