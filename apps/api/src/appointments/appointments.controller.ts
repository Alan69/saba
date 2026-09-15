import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AppointmentStatus, PaymentMethod } from '@prisma/client';
import { AppointmentsService, CreateAppointmentInput } from './appointments.service';
import { Roles } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/auth.types';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('date') date?: string) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    return this.appointments.listByDate(user, d);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.appointments.getById(user.company_id, id);
  }

  @Roles('owner', 'admin')
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() input: CreateAppointmentInput) {
    return this.appointments.create(user, input);
  }

  @Patch(':id/status')
  transition(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { status: AppointmentStatus; cancelReason?: string; paymentMethod?: PaymentMethod },
  ) {
    return this.appointments.transition(user, id, body.status, body);
  }

  @Roles('owner', 'admin')
  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { cancelReason: string },
  ) {
    return this.appointments.transition(user, id, 'cancelled', body);
  }

  @Roles('owner', 'admin')
  @Post(':id/payment')
  payment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { paymentMethod: PaymentMethod },
  ) {
    return this.appointments.transition(user, id, 'paid', body);
  }

  @Roles('owner', 'admin')
  @Patch(':id/price')
  price(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { price: number; ownerCode?: string },
  ) {
    return this.appointments.changePrice(user, id, body.price, body.ownerCode);
  }

  @Roles('owner', 'admin')
  @Patch(':id/reschedule')
  reschedule(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { boxId: string; startAt: string },
  ) {
    return this.appointments.reschedule(user, id, body.boxId, body.startAt);
  }

  @Roles('master', 'owner', 'admin')
  @Post(':id/master-nps')
  masterNps(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { score: number; comment?: string },
  ) {
    return this.appointments.masterNps(user, id, body.score, body.comment);
  }
}
