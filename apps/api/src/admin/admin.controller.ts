import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateCompanyDto } from './admin.dto';
import { Roles } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/auth.types';

// company_id супер-админа — служебная «платформенная» компания, её в выдаче не показываем
@Roles('superadmin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview(@CurrentUser() u: JwtPayload) {
    return this.admin.overview(u.company_id);
  }

  @Get('analytics')
  analytics(@CurrentUser() u: JwtPayload) {
    return this.admin.analytics(u.company_id);
  }

  @Get('audit')
  audit(
    @CurrentUser() u: JwtPayload,
    @Query('companyId') companyId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.globalAudit(u.company_id, companyId, limit ? Number(limit) : undefined);
  }

  @Get('companies')
  companies(@CurrentUser() u: JwtPayload, @Query('search') search?: string) {
    return this.admin.listCompanies(u.company_id, search?.trim() || undefined);
  }

  @Get('companies/:id')
  detail(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.companyDetail(u.company_id, id);
  }

  @Patch('companies/:id')
  update(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.admin.updateCompany(u.company_id, id, dto, { id: u.sub, name: u.name });
  }

  @Delete('companies/:id')
  remove(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.softDeleteCompany(u.company_id, id, { id: u.sub, name: u.name });
  }

  @Post('companies/:id/impersonate')
  impersonate(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.impersonate(u.company_id, id, { id: u.sub, name: u.name });
  }

  @Post('companies/:id/reset-owner-password')
  resetPassword(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.resetOwnerPassword(u.company_id, id, { id: u.sub, name: u.name });
  }
}
