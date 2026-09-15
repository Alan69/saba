import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CompaniesService, UpdateCompanyInput } from './companies.service';
import { Roles } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/auth.types';

@Controller('company')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.companies.get(user.company_id);
  }

  @Roles('owner', 'admin')
  @Patch()
  update(@CurrentUser() user: JwtPayload, @Body() input: UpdateCompanyInput) {
    return this.companies.update(user, input);
  }

  @Roles('owner')
  @Post('price-code')
  setPriceCode(@CurrentUser() user: JwtPayload, @Body('code') code: string) {
    return this.companies.setPriceCode(user, code);
  }

  @Roles('owner', 'admin')
  @Post('car-sizes')
  setCarSizes(@CurrentUser() user: JwtPayload, @Body('carSizes') carSizes: any[]) {
    return this.companies.setCarSizes(user, carSizes);
  }
}
