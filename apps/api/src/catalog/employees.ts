import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PLAN_LIMITS } from '../common/plan-limits';
import { Roles } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/auth.types';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['master', 'admin'])
  role?: 'master' | 'admin';

  @IsOptional()
  @IsString()
  @MinLength(4)
  pin?: string;
}

export class UpdateEmployeeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsIn(['master', 'admin']) role?: 'master' | 'admin';
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MinLength(4) pin?: string;
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, phone: true, role: true, active: true,
        createdAt: true, pinHash: true,
      },
    }).then((rows) =>
      rows.map(({ pinHash, ...e }) => ({ ...e, hasPin: Boolean(pinHash) })),
    );
  }

  async create(user: JwtPayload, dto: CreateEmployeeDto) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: user.company_id } });
    const limit = PLAN_LIMITS[company.plan].masters;
    const count = await this.prisma.employee.count({
      where: { companyId: user.company_id, deletedAt: null, active: true },
    });
    if (count >= limit) {
      throw new ForbiddenException('Достигнут лимит мастеров для вашего плана');
    }
    const employee = await this.prisma.employee.create({
      data: {
        companyId: user.company_id,
        name: dto.name,
        phone: dto.phone,
        role: dto.role ?? 'master',
        pinHash: dto.pin ? await bcrypt.hash(dto.pin, 10) : null,
      },
    });
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'create', entity: 'employee', entityId: employee.id, details: { name: employee.name },
    });
    const { pinHash, ...rest } = employee;
    return { ...rest, hasPin: Boolean(pinHash) };
  }

  async update(user: JwtPayload, id: string, dto: UpdateEmployeeDto) {
    await this.prisma.employee.findFirstOrThrow({ where: { id, companyId: user.company_id } });
    const { pin, ...data } = dto;
    const employee = await this.prisma.employee.update({
      where: { id },
      data: { ...data, ...(pin ? { pinHash: await bcrypt.hash(pin, 10) } : {}) },
    });
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'update', entity: 'employee', entityId: id, details: { fields: Object.keys(dto) },
    });
    const { pinHash, ...rest } = employee;
    return { ...rest, hasPin: Boolean(pinHash) };
  }

  async remove(user: JwtPayload, id: string) {
    await this.prisma.employee.findFirstOrThrow({ where: { id, companyId: user.company_id } });
    await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'delete', entity: 'employee', entityId: id,
    });
    return { ok: true };
  }
}

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.employees.list(user.company_id);
  }

  @Roles('owner', 'admin')
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user, dto);
  }

  @Roles('owner', 'admin')
  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(user, id, dto);
  }

  @Roles('owner')
  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.employees.remove(user, id);
  }
}
