import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SalaryRuleInput, SalaryService } from './salary.service';
import { Roles } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/auth.types';

@Controller('salary')
export class SalaryController {
  constructor(private readonly salary: SalaryService) {}

  @Roles('owner')
  @Get('rules')
  listRules(@CurrentUser() user: JwtPayload) {
    return this.salary.listRules(user.company_id);
  }

  @Roles('owner')
  @Post('rules')
  createRule(@CurrentUser() user: JwtPayload, @Body() input: SalaryRuleInput) {
    return this.salary.createRule(user, input);
  }

  @Roles('owner')
  @Patch('rules/:id')
  updateRule(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() input: Partial<SalaryRuleInput>,
  ) {
    return this.salary.updateRule(user, id, input);
  }

  @Roles('owner')
  @Delete('rules/:id')
  deleteRule(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.salary.deleteRule(user, id);
  }

  @Roles('owner', 'master')
  @Get('summary')
  summary(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.salary.summary(user, from, to, employeeId);
  }
}
