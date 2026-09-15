import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CarInput, ClientInput, ClientsService } from './clients.service';
import { Roles } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/auth.types';

@Roles('owner', 'admin')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
    @Query('segment') segment?: string,
  ) {
    return this.clients.list(user, search, segment);
  }

  @Get('by-phone/:phone')
  byPhone(@CurrentUser() user: JwtPayload, @Param('phone') phone: string) {
    return this.clients.findByPhone(user, phone);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.clients.get(user, id);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() input: ClientInput & { phone: string; cars?: CarInput[] },
  ) {
    return this.clients.create(user, input);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() input: ClientInput) {
    return this.clients.update(user, id, input);
  }

  @Post(':id/cars')
  addCar(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() car: CarInput) {
    return this.clients.addCar(user, id, car);
  }

  @Delete(':id/cars/:carId')
  removeCar(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('carId') carId: string,
  ) {
    return this.clients.removeCar(user, id, carId);
  }
}
