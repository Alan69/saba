import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/auth.types';
import { resolveCarSizes } from '../common/car-sizes';
import { LoginDto, PinLoginDto, RefreshDto, RegisterDto } from './auth.dto';

const REFRESH_TTL_DAYS = 30;

const DEFAULT_WORKING_HOURS = {
  mon: { enabled: true, start: '09:00', end: '20:00' },
  tue: { enabled: true, start: '09:00', end: '20:00' },
  wed: { enabled: true, start: '09:00', end: '20:00' },
  thu: { enabled: true, start: '09:00', end: '20:00' },
  fri: { enabled: true, start: '09:00', end: '20:00' },
  sat: { enabled: true, start: '09:00', end: '20:00' },
  sun: { enabled: false, start: '09:00', end: '20:00' },
};

function slugify(name: string): string {
  const translit: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    ә: 'a', ғ: 'g', қ: 'q', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
  };
  return name
    .toLowerCase()
    .split('')
    .map((ch) => translit[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'company';
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async issueTokens(payload: JwtPayload, fingerprint?: string) {
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '15m' });
    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: hashToken(refreshToken),
        fingerprint: fingerprint ?? null,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing) throw new BadRequestException('Пользователь с таким телефоном уже существует');

    const baseSlug = slugify(dto.companyName);
    let slug = baseSlug;
    for (let i = 2; await this.prisma.company.findUnique({ where: { slug } }); i++) {
      slug = `${baseSlug}-${i}`;
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const trialEnd = new Date(Date.now() + 14 * 24 * 3600 * 1000);

    const { user, company } = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.companyName,
          slug,
          phone: dto.phone,
          plan: 'business',
          isTrial: true,
          planExpiresAt: trialEnd,
          workingHours: DEFAULT_WORKING_HOURS,
        },
      });
      const user = await tx.user.create({
        data: {
          companyId: company.id,
          phone: dto.phone,
          passwordHash,
          name: dto.name ?? 'Владелец',
          role: 'owner',
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: company.id,
          userId: user.id,
          actorName: user.name,
          action: 'register',
          entity: 'company',
          entityId: company.id,
          details: { plan: 'business', trial: true },
        },
      });
      return { user, company };
    });

    const payload: JwtPayload = {
      sub: user.id,
      role: 'owner',
      company_id: company.id,
      name: user.name,
    };
    const tokens = await this.issueTokens(payload);
    return { ...tokens, user: this.publicUser(user), company: this.publicCompany(company) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: { company: true },
    });
    if (!user || user.deletedAt) throw new UnauthorizedException('Неверный телефон или пароль');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Неверный телефон или пароль');

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      company_id: user.companyId,
      name: user.name,
    };
    const tokens = await this.issueTokens(payload, dto.fingerprint);
    return {
      ...tokens,
      user: this.publicUser(user),
      company: this.publicCompany(user.company),
    };
  }

  async refresh(dto: RefreshDto) {
    const tokenHash = hashToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { include: { company: true } } },
    });
    if (!stored) throw new UnauthorizedException('Refresh token недействителен');

    // rotation: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const payload: JwtPayload = {
      sub: stored.user.id,
      role: stored.user.role,
      company_id: stored.user.companyId,
      name: stored.user.name,
    };
    const tokens = await this.issueTokens(payload, dto.fingerprint);
    return {
      ...tokens,
      user: this.publicUser(stored.user),
      company: this.publicCompany(stored.user.company),
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async pinLogin(dto: PinLoginDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || employee.deletedAt || !employee.active || !employee.pinHash) {
      throw new UnauthorizedException('Неверный PIN');
    }
    const ok = await bcrypt.compare(dto.pin, employee.pinHash);
    if (!ok) throw new UnauthorizedException('Неверный PIN');

    const payload: JwtPayload = {
      sub: employee.id,
      role: 'master',
      company_id: employee.companyId,
      employee_id: employee.id,
      name: employee.name,
    };
    const shortToken = await this.jwt.signAsync(payload, { expiresIn: '4h' });
    return { shortToken, employee: { id: employee.id, name: employee.name } };
  }

  async me(userId: string, role: string, companyId: string) {
    if (role === 'master') {
      const employee = await this.prisma.employee.findUnique({ where: { id: userId } });
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      return { user: employee ? { id: employee.id, name: employee.name, role: 'master' } : null, company: company && this.publicCompany(company) };
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });
    if (!user) throw new UnauthorizedException();
    return { user: this.publicUser(user), company: this.publicCompany(user.company) };
  }

  private publicUser(u: { id: string; phone: string; name: string; role: string; language: string }) {
    return { id: u.id, phone: u.phone, name: u.name, role: u.role, language: u.language };
  }

  private publicCompany(c: any) {
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      businessType: c.businessType,
      phone: c.phone,
      address: c.address,
      city: c.city,
      timezone: c.timezone,
      language: c.language,
      plan: c.plan,
      isTrial: c.isTrial,
      planExpiresAt: c.planExpiresAt,
      mode: c.mode,
      accentColor: c.accentColor,
      workingHours: c.workingHours,
      carSizes: resolveCarSizes(c.settings),
      wizardStep: c.wizardStep,
      wizardDone: c.wizardDone,
    };
  }
}
