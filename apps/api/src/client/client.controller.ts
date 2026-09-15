import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CarSize } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { ClientService } from './client.service';
import { ClientGuard, ClientPrincipal, CurrentClient } from './client.guard';
import { Public } from '../common/jwt-auth.guard';

@Public() // отключаем глобальный admin-guard; кабинет защищён ClientGuard
@Controller('client')
export class ClientController {
  constructor(private readonly client: ClientService) {}

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post(':slug/send-otp')
  sendOtp(@Param('slug') slug: string, @Body('phone') phone: string) {
    return this.client.sendOtp(slug, phone);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post(':slug/verify-otp')
  verifyOtp(
    @Param('slug') slug: string,
    @Body() body: { phone: string; code: string },
  ) {
    return this.client.verifyOtp(slug, body.phone, body.code);
  }

  @UseGuards(ClientGuard)
  @Get('me')
  me(@CurrentClient() principal: ClientPrincipal) {
    return this.client.profile(principal);
  }

  @UseGuards(ClientGuard)
  @Post('appointments/:id/cancel')
  cancel(@CurrentClient() principal: ClientPrincipal, @Param('id') id: string) {
    return this.client.cancelAppointment(principal, id);
  }

  @UseGuards(ClientGuard)
  @Post('cars')
  addCar(
    @CurrentClient() principal: ClientPrincipal,
    @Body() body: { brand: string; plateNumber?: string; size?: CarSize },
  ) {
    return this.client.addCar(principal, body);
  }

  @UseGuards(ClientGuard)
  @Patch('cars/:id')
  updateCar(
    @CurrentClient() principal: ClientPrincipal,
    @Param('id') id: string,
    @Body() body: { brand?: string; plateNumber?: string; size?: CarSize },
  ) {
    return this.client.updateCar(principal, id, body);
  }

  @UseGuards(ClientGuard)
  @Delete('cars/:id')
  deleteCar(@CurrentClient() principal: ClientPrincipal, @Param('id') id: string) {
    return this.client.deleteCar(principal, id);
  }
}
