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
import { IsHexColor, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PLAN_LIMITS } from '../common/plan-limits';
import { Roles } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/auth.types';

export class CreateBoxDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateBoxDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  status?: 'active' | 'inactive';
}

@Injectable()
export class BoxesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string) {
    return this.prisma.box.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(user: JwtPayload, dto: CreateBoxDto) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: user.company_id } });
    const limit = PLAN_LIMITS[company.plan].boxes;
    const count = await this.prisma.box.count({
      where: { companyId: user.company_id, deletedAt: null, status: 'active' },
    });
    if (count >= limit) {
      throw new ForbiddenException(
        `Ваш план ${company.plan === 'light' ? 'Light' : 'Business'}: до ${limit} боксов. Обновите план →`,
      );
    }
    const box = await this.prisma.box.create({
      data: {
        companyId: user.company_id,
        name: dto.name,
        color: dto.color,
        sortOrder: dto.sortOrder ?? count,
      },
    });
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'create', entity: 'box', entityId: box.id, details: { name: box.name },
    });
    return box;
  }

  async update(user: JwtPayload, id: string, dto: UpdateBoxDto) {
    await this.prisma.box.findFirstOrThrow({ where: { id, companyId: user.company_id } });
    const box = await this.prisma.box.update({ where: { id }, data: dto });
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'update', entity: 'box', entityId: id, details: dto as any,
    });
    return box;
  }

  async remove(user: JwtPayload, id: string) {
    await this.prisma.box.findFirstOrThrow({ where: { id, companyId: user.company_id } });
    await this.prisma.box.update({ where: { id }, data: { deletedAt: new Date(), status: 'inactive' } });
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'delete', entity: 'box', entityId: id,
    });
    return { ok: true };
  }
}

@Controller('boxes')
export class BoxesController {
  constructor(private readonly boxes: BoxesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.boxes.list(user.company_id);
  }

  @Roles('owner', 'admin')
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBoxDto) {
    return this.boxes.create(user, dto);
  }

  @Roles('owner', 'admin')
  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateBoxDto) {
    return this.boxes.update(user, id, dto);
  }

  @Roles('owner')
  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.boxes.remove(user, id);
  }
}
