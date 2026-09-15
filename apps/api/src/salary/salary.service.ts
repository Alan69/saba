import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, SalaryRuleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PLAN_LIMITS } from '../common/plan-limits';
import { JwtPayload } from '../common/auth.types';

export interface SalaryRuleInput {
  employeeId?: string | null;
  type: SalaryRuleType;
  config: Record<string, unknown>;
  sortOrder?: number;
  active?: boolean;
}

@Injectable()
export class SalaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertBusiness(companyId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    if (!PLAN_LIMITS[company.plan].features.salary) {
      throw new ForbiddenException('Расчёт зарплат доступен в Business. Обновить →');
    }
  }

  async listRules(companyId: string) {
    await this.assertBusiness(companyId);
    return this.prisma.salaryRule.findMany({
      where: { companyId, deletedAt: null },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createRule(user: JwtPayload, input: SalaryRuleInput) {
    await this.assertBusiness(user.company_id);
    const rule = await this.prisma.salaryRule.create({
      data: {
        companyId: user.company_id,
        employeeId: input.employeeId ?? null,
        type: input.type,
        config: input.config as Prisma.InputJsonValue,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true,
      },
    });
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'create', entity: 'salary_rule', entityId: rule.id, details: { type: input.type },
    });
    return rule;
  }

  async updateRule(user: JwtPayload, id: string, input: Partial<SalaryRuleInput>) {
    await this.assertBusiness(user.company_id);
    await this.prisma.salaryRule.findFirstOrThrow({ where: { id, companyId: user.company_id } });
    const rule = await this.prisma.salaryRule.update({
      where: { id },
      data: {
        ...(input.employeeId !== undefined ? { employeeId: input.employeeId } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.config ? { config: input.config as Prisma.InputJsonValue } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    return rule;
  }

  async deleteRule(user: JwtPayload, id: string) {
    await this.assertBusiness(user.company_id);
    await this.prisma.salaryRule.findFirstOrThrow({ where: { id, companyId: user.company_id } });
    await this.prisma.salaryRule.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    return { ok: true };
  }

  /**
   * Сводка начислений за период: percent — из накопленных accruals,
   * fixed_shift / fixed_month / threshold_bonus — вычисляются по правилам.
   */
  async summary(user: JwtPayload, from: string, to: string, employeeId?: string) {
    await this.assertBusiness(user.company_id);
    const companyId = user.company_id;
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T23:59:59Z`);

    // мастер видит только своё (ТЗ 7)
    const empFilter = user.role === 'master' ? user.employee_id : employeeId;

    const employees = await this.prisma.employee.findMany({
      where: {
        companyId, deletedAt: null,
        ...(empFilter ? { id: empFilter } : {}),
      },
    });
    const rules = await this.prisma.salaryRule.findMany({
      where: { companyId, deletedAt: null, active: true },
      orderBy: { sortOrder: 'asc' },
    });
    const accruals = await this.prisma.salaryAccrual.groupBy({
      by: ['employeeId'],
      where: { companyId, periodDate: { gte: start, lte: end } },
      _sum: { amount: true },
    });
    const paidAppts = await this.prisma.appointment.findMany({
      where: {
        companyId, status: 'paid', deletedAt: null,
        startAt: { gte: start, lte: end },
        employeeId: { not: null },
      },
      select: { employeeId: true, startAt: true, price: true },
    });

    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000)));
    const result = employees.map((emp) => {
      const percentSum = Number(accruals.find((a) => a.employeeId === emp.id)?._sum.amount ?? 0);
      const empAppts = paidAppts.filter((a) => a.employeeId === emp.id);
      const empRevenue = empAppts.reduce((s, a) => s + Number(a.price), 0);
      const workedDays = new Set(empAppts.map((a) => a.startAt.toISOString().slice(0, 10))).size;

      let fixed = 0;
      let bonus = 0;
      const details: { rule: string; amount: number }[] = [];
      if (percentSum > 0) details.push({ rule: 'Процент от услуг', amount: percentSum });

      for (const rule of rules) {
        if (rule.employeeId && rule.employeeId !== emp.id) continue;
        const cfg = rule.config as Record<string, number>;
        if (rule.type === 'fixed_shift') {
          const amount = Number(cfg.amount ?? 0) * workedDays;
          if (amount > 0) { fixed += amount; details.push({ rule: `Фикс за смену × ${workedDays}`, amount }); }
        } else if (rule.type === 'fixed_month') {
          const amount = Number(cfg.amount ?? 0) * (days / 30);
          if (amount > 0) { fixed += amount; details.push({ rule: 'Фикс в месяц (пропорц.)', amount: Math.round(amount) }); }
        } else if (rule.type === 'threshold_bonus') {
          const threshold = Number(cfg.threshold ?? 0);
          const percent = Number(cfg.percent ?? 0);
          if (empRevenue > threshold && percent > 0) {
            const amount = ((empRevenue - threshold) * percent) / 100;
            bonus += amount;
            details.push({ rule: `Бонус ${percent}% сверх ${threshold} ₸`, amount: Math.round(amount) });
          }
        }
      }

      return {
        employeeId: emp.id,
        name: emp.name,
        revenue: empRevenue,
        appointments: empAppts.length,
        workedDays,
        percent: Math.round(percentSum),
        fixed: Math.round(fixed),
        bonus: Math.round(bonus),
        total: Math.round(percentSum + fixed + bonus),
        details,
      };
    });

    return { from, to, employees: result };
  }
}
