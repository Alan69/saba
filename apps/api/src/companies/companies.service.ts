import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../common/auth.types';
import { CarSizeConfig, resolveCarSizes } from '../common/car-sizes';

export interface UpdateCompanyInput {
  name?: string;
  businessType?: string;
  phone?: string;
  address?: string;
  city?: string;
  timezone?: string;
  language?: string;
  accentColor?: string;
  workingHours?: Record<string, { enabled: boolean; start: string; end: string }>;
  settings?: Record<string, unknown>;
  wizardStep?: number;
  wizardDone?: boolean;
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException();
    const { settings, ...rest } = company as any;
    // priceCode не отдаём наружу
    const { priceCode, ...publicSettings } = (settings ?? {}) as Record<string, unknown>;
    return {
      ...rest,
      settings: publicSettings,
      carSizes: resolveCarSizes(settings),
      hasPriceCode: Boolean(priceCode),
    };
  }

  async setCarSizes(user: JwtPayload, sizes: CarSizeConfig[]) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: user.company_id } });
    const normalized = resolveCarSizes({ carSizes: sizes });
    const settings = {
      ...((company.settings as Record<string, unknown>) ?? {}),
      carSizes: normalized.map((s) => ({
        key: String(s.key),
        label: s.label,
        examples: s.examples,
        enabled: s.enabled,
      })),
    } as unknown as Prisma.InputJsonValue;
    await this.prisma.company.update({ where: { id: user.company_id }, data: { settings } });
    await this.audit.log({
      companyId: user.company_id,
      userId: user.sub,
      actorName: user.name ?? '',
      action: 'update',
      entity: 'car_sizes',
      entityId: user.company_id,
    });
    return { carSizes: normalized };
  }

  async update(user: JwtPayload, input: UpdateCompanyInput) {
    const data: Prisma.CompanyUpdateInput = {};
    for (const key of [
      'name', 'businessType', 'phone', 'address', 'city', 'timezone',
      'language', 'accentColor', 'wizardStep', 'wizardDone',
    ] as const) {
      if (input[key] !== undefined) (data as any)[key] = input[key];
    }
    if (input.workingHours !== undefined) data.workingHours = input.workingHours as Prisma.InputJsonValue;
    if (input.settings !== undefined) {
      const current = await this.prisma.company.findUnique({ where: { id: user.company_id } });
      data.settings = {
        ...((current?.settings as Record<string, unknown>) ?? {}),
        ...input.settings,
      } as Prisma.InputJsonValue;
    }
    await this.prisma.company.update({ where: { id: user.company_id }, data });
    await this.audit.log({
      companyId: user.company_id,
      userId: user.sub,
      actorName: user.name ?? '',
      action: 'update',
      entity: 'company',
      entityId: user.company_id,
      details: { fields: Object.keys(input) },
    });
    return this.get(user.company_id);
  }

  async setPriceCode(user: JwtPayload, code: string) {
    const company = await this.prisma.company.findUnique({ where: { id: user.company_id } });
    if (!company) throw new NotFoundException();
    const settings = { ...((company.settings as Record<string, unknown>) ?? {}), priceCode: code };
    await this.prisma.company.update({
      where: { id: user.company_id },
      data: { settings: settings as Prisma.InputJsonValue },
    });
    await this.audit.log({
      companyId: user.company_id,
      userId: user.sub,
      actorName: user.name ?? '',
      action: 'set_price_code',
      entity: 'company',
      entityId: user.company_id,
    });
    return { ok: true };
  }
}
