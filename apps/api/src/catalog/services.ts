import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/auth.types';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsInt()
  @Min(5)
  durationMin!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsObject()
  priceBySize?: Record<string, number>;
}

export class UpdateServiceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsInt() @Min(5) durationMin?: number;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsObject() priceBySize?: Record<string, number>;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string) {
    return this.prisma.service.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(user: JwtPayload, dto: CreateServiceDto) {
    const service = await this.prisma.service.create({
      data: {
        companyId: user.company_id,
        name: dto.name,
        category: dto.category,
        durationMin: dto.durationMin,
        price: dto.price,
        priceBySize: dto.priceBySize,
      },
    });
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'create', entity: 'service', entityId: service.id, details: { name: service.name },
    });
    return service;
  }

  async update(user: JwtPayload, id: string, dto: UpdateServiceDto) {
    await this.prisma.service.findFirstOrThrow({ where: { id, companyId: user.company_id } });
    const service = await this.prisma.service.update({ where: { id }, data: dto });
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'update', entity: 'service', entityId: id, details: dto as any,
    });
    return service;
  }

  async remove(user: JwtPayload, id: string) {
    await this.prisma.service.findFirstOrThrow({ where: { id, companyId: user.company_id } });
    await this.prisma.service.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await this.audit.log({
      companyId: user.company_id, userId: user.sub, actorName: user.name ?? '',
      action: 'delete', entity: 'service', entityId: id,
    });
    return { ok: true };
  }
}

@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.services.list(user.company_id);
  }

  @Roles('owner', 'admin')
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateServiceDto) {
    return this.services.create(user, dto);
  }

  @Roles('owner', 'admin')
  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(user, id, dto);
  }

  @Roles('owner')
  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.services.remove(user, id);
  }
}
