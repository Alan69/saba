import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { Roles } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/auth.types';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Roles('owner')
  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.audit.list(user.company_id, limit ? Number(limit) : undefined);
  }
}
