import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { UpdateCompanyDto } from './admin.dto';

// ponytail: списки без пагинации, потолок 200 — хватит до первой сотни тенантов
const LIST_LIMIT = 200;
const ANALYTICS_DAYS = 30;

type Actor = { id: string; name?: string };

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  private async requireCompany(platformCompanyId: string, id: string) {
    if (id === platformCompanyId) throw new NotFoundException('Компания не найдена');
    const company = await this.prisma.company.findFirst({ where: { id, deletedAt: null } });
    if (!company) throw new NotFoundException('Компания не найдена');
    return company;
  }

  async overview(platformCompanyId: string) {
    const notPlatform = { id: { not: platformCompanyId }, deletedAt: null };
    // считаем только живых тенантов: удалённые компании выпадают из всех метрик
    const tenantScope = { companyId: { not: platformCompanyId }, company: { deletedAt: null } };
    const since = new Date(Date.now() - ANALYTICS_DAYS * 24 * 3600 * 1000);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [companies, byMode, users, appointments, newCompanies, appts30d, apptsToday, revenue] =
      await Promise.all([
        this.prisma.company.count({ where: notPlatform }),
        this.prisma.company.groupBy({ by: ['mode'], where: notPlatform, _count: true }),
        this.prisma.user.count({ where: { ...tenantScope, deletedAt: null } }),
        this.prisma.appointment.count({ where: tenantScope }),
        this.prisma.company.count({ where: { ...notPlatform, createdAt: { gte: since } } }),
        this.prisma.appointment.count({ where: { ...tenantScope, createdAt: { gte: since } } }),
        this.prisma.appointment.count({ where: { ...tenantScope, startAt: { gte: dayStart } } }),
        this.prisma.appointment.aggregate({
          where: { ...tenantScope, status: 'paid', paidAt: { gte: since } },
          _sum: { price: true },
        }),
      ]);

    const modes = Object.fromEntries(byMode.map((m) => [m.mode, m._count]));
    return {
      companies,
      users,
      appointments,
      active: modes.active ?? 0,
      readOnly: modes.read_only ?? 0,
      frozen: modes.frozen ?? 0,
      newCompanies30d: newCompanies,
      appointments30d: appts30d,
      appointmentsToday: apptsToday,
      revenue30d: Number(revenue._sum.price ?? 0),
    };
  }

  async listCompanies(platformCompanyId: string, search?: string) {
    const companies = await this.prisma.company.findMany({
      where: {
        id: { not: platformCompanyId },
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { slug: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
      include: {
        _count: { select: { users: true, employees: true, clients: true, appointments: true } },
        users: {
          where: { role: 'owner', deletedAt: null },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { name: true, phone: true },
        },
      },
    });

    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      phone: c.phone,
      city: c.city,
      plan: c.plan,
      mode: c.mode,
      isTrial: c.isTrial,
      planExpiresAt: c.planExpiresAt,
      createdAt: c.createdAt,
      owner: c.users[0] ?? null,
      counts: c._count,
    }));
  }

  async companyDetail(platformCompanyId: string, id: string) {
    const company = await this.requireCompany(platformCompanyId, id);
    const since = new Date(Date.now() - ANALYTICS_DAYS * 24 * 3600 * 1000);

    const [users, employees, boxes, services, clients, appointments, revenue, byStatus, lastAppointments, audit] =
      await Promise.all([
        this.prisma.user.findMany({
          where: { companyId: id, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, phone: true, role: true, createdAt: true },
        }),
        this.prisma.employee.count({ where: { companyId: id, deletedAt: null } }),
        this.prisma.box.count({ where: { companyId: id, deletedAt: null } }),
        this.prisma.service.count({ where: { companyId: id, deletedAt: null } }),
        this.prisma.client.count({ where: { companyId: id, deletedAt: null } }),
        this.prisma.appointment.count({ where: { companyId: id } }),
        this.prisma.appointment.aggregate({
          where: { companyId: id, status: 'paid', paidAt: { gte: since } },
          _sum: { price: true },
        }),
        this.prisma.appointment.groupBy({ by: ['status'], where: { companyId: id }, _count: true }),
        this.prisma.appointment.findMany({
          where: { companyId: id },
          orderBy: { startAt: 'desc' },
          take: 10,
          select: {
            id: true, code: true, startAt: true, status: true, price: true, source: true,
            client: { select: { name: true, phone: true } },
            service: { select: { name: true } },
          },
        }),
        this.audit.list(id, 20),
      ]);

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        phone: company.phone,
        address: company.address,
        city: company.city,
        timezone: company.timezone,
        plan: company.plan,
        mode: company.mode,
        isTrial: company.isTrial,
        planExpiresAt: company.planExpiresAt,
        wizardDone: company.wizardDone,
        createdAt: company.createdAt,
      },
      users,
      counts: { employees, boxes, services, clients, appointments },
      revenue30d: Number(revenue._sum.price ?? 0),
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      lastAppointments: lastAppointments.map((a) => ({
        ...a,
        price: Number(a.price),
      })),
      audit,
    };
  }

  async updateCompany(platformCompanyId: string, id: string, dto: UpdateCompanyDto, actor: Actor) {
    await this.requireCompany(platformCompanyId, id);
    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.plan !== undefined ? { plan: dto.plan } : {}),
        ...(dto.isTrial !== undefined ? { isTrial: dto.isTrial } : {}),
        ...(dto.planExpiresAt !== undefined ? { planExpiresAt: new Date(dto.planExpiresAt) } : {}),
      },
    });
    await this.audit.log({
      companyId: id,
      userId: actor.id,
      actorName: actor.name ?? 'superadmin',
      action: 'update',
      entity: 'company',
      entityId: id,
      details: { by: 'superadmin', ...dto },
    });
    return {
      id: updated.id,
      mode: updated.mode,
      plan: updated.plan,
      isTrial: updated.isTrial,
      planExpiresAt: updated.planExpiresAt,
    };
  }

  async softDeleteCompany(platformCompanyId: string, id: string, actor: Actor) {
    await this.requireCompany(platformCompanyId, id);
    await this.audit.log({
      companyId: id,
      userId: actor.id,
      actorName: actor.name ?? 'superadmin',
      action: 'delete',
      entity: 'company',
      entityId: id,
      details: { by: 'superadmin' },
    });
    await this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date(), mode: 'frozen' },
    });
    // все активные сессии тенанта гасим
    await this.prisma.refreshToken.updateMany({
      where: { user: { companyId: id }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { id, deleted: true };
  }

  /** Выдаёт токены владельца компании — режим «войти как» для поддержки. */
  async impersonate(platformCompanyId: string, id: string, actor: Actor) {
    const company = await this.requireCompany(platformCompanyId, id);
    const owner = await this.prisma.user.findFirst({
      where: { companyId: id, deletedAt: null },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    if (!owner) throw new BadRequestException('В компании нет пользователей');

    const tokens = await this.auth.issueTokens(
      { sub: owner.id, role: owner.role, company_id: id, name: owner.name },
      'superadmin-impersonate',
    );
    await this.audit.log({
      companyId: id,
      userId: actor.id,
      actorName: actor.name ?? 'superadmin',
      action: 'impersonate',
      entity: 'company',
      entityId: id,
      details: { by: 'superadmin', asUser: owner.phone },
    });
    return {
      ...tokens,
      company: { id: company.id, name: company.name },
      user: { id: owner.id, name: owner.name, phone: owner.phone, role: owner.role },
    };
  }

  /** Сбрасывает пароль владельца и возвращает новый — для поддержки. */
  async resetOwnerPassword(platformCompanyId: string, id: string, actor: Actor) {
    await this.requireCompany(platformCompanyId, id);
    const owner = await this.prisma.user.findFirst({
      where: { companyId: id, role: 'owner', deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!owner) throw new BadRequestException('У компании нет владельца');

    const password = randomBytes(9).toString('base64url').slice(0, 12);
    await this.prisma.user.update({
      where: { id: owner.id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: owner.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      companyId: id,
      userId: actor.id,
      actorName: actor.name ?? 'superadmin',
      action: 'reset_password',
      entity: 'user',
      entityId: owner.id,
      details: { by: 'superadmin' },
    });
    return { phone: owner.phone, name: owner.name, password };
  }

  /** Сквозной аудит по всем тенантам. */
  async globalAudit(platformCompanyId: string, companyId?: string, limit = 100) {
    const entries = await this.prisma.auditLog.findMany({
      where: companyId
        ? { companyId }
        : { companyId: { not: platformCompanyId }, company: { deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      include: { company: { select: { name: true, slug: true } } },
    });
    return entries.map((e) => ({
      id: e.id,
      companyId: e.companyId,
      companyName: e.company.name,
      actorName: e.actorName,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      details: e.details,
      createdAt: e.createdAt,
    }));
  }

  async analytics(platformCompanyId: string) {
    const since = new Date(Date.now() - ANALYTICS_DAYS * 24 * 3600 * 1000);

    const [signups, appts, top] = await Promise.all([
      this.prisma.$queryRaw<{ day: Date; n: bigint }[]>`
        SELECT date_trunc('day', created_at) AS day, count(*)::bigint AS n
        FROM companies
        WHERE created_at >= ${since} AND deleted_at IS NULL AND id <> ${platformCompanyId}::uuid
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ day: Date; n: bigint }[]>`
        SELECT date_trunc('day', a.created_at) AS day, count(*)::bigint AS n
        FROM appointments a JOIN companies c ON c.id = a.company_id
        WHERE a.created_at >= ${since} AND c.deleted_at IS NULL AND c.id <> ${platformCompanyId}::uuid
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ id: string; name: string; n: bigint; revenue: string | null }[]>`
        SELECT c.id, c.name, count(a.id)::bigint AS n,
               coalesce(sum(a.price) FILTER (WHERE a.status = 'paid'), 0)::text AS revenue
        FROM companies c
        JOIN appointments a ON a.company_id = c.id AND a.created_at >= ${since}
        WHERE c.deleted_at IS NULL AND c.id <> ${platformCompanyId}::uuid
        GROUP BY c.id, c.name ORDER BY n DESC LIMIT 10`,
    ]);

    const toSeries = (rows: { day: Date; n: bigint }[]) =>
      rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), n: Number(r.n) }));

    return {
      days: ANALYTICS_DAYS,
      signups: toSeries(signups),
      appointments: toSeries(appts),
      topCompanies: top.map((t) => ({
        id: t.id,
        name: t.name,
        appointments: Number(t.n),
        revenue: Number(t.revenue ?? 0),
      })),
    };
  }
}
