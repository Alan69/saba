import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/auth.types';

@Roles('owner')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('today')
  today(@CurrentUser() user: JwtPayload) {
    return this.dashboard.today(user.company_id);
  }

  @Get('analytics')
  analytics(@CurrentUser() user: JwtPayload, @Query('period') period?: 'week' | 'month') {
    return this.dashboard.analytics(user.company_id, period ?? 'week');
  }
}
