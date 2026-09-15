import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WidgetService } from './widget.service';
import { Public } from '../common/jwt-auth.guard';

@Public()
@Controller('widget')
export class WidgetController {
  constructor(private readonly widget: WidgetService) {}

  @Get(':slug')
  info(@Param('slug') slug: string) {
    return this.widget.publicInfo(slug);
  }

  @Get(':slug/slots')
  slots(
    @Param('slug') slug: string,
    @Query('date') date: string,
    @Query('serviceId') serviceId?: string,
    @Query('serviceIds') serviceIds?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const ids = serviceIds ? serviceIds.split(',').filter(Boolean) : serviceId ? [serviceId] : [];
    return this.widget.slots(slug, date, ids, employeeId || undefined);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post(':slug/reserve')
  reserve(
    @Param('slug') slug: string,
    @Body() body: { startAt: string; serviceId?: string; serviceIds?: string[]; boxId?: string; employeeId?: string },
  ) {
    return this.widget.reserve(slug, body);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post(':slug/book')
  book(@Param('slug') slug: string, @Body() body: any) {
    return this.widget.book(slug, body);
  }

  @Get(':slug/booking/:code')
  status(@Param('slug') slug: string, @Param('code') code: string) {
    return this.widget.bookingStatus(slug, code);
  }

  @Post(':slug/booking/:code/cancel')
  cancel(@Param('slug') slug: string, @Param('code') code: string) {
    return this.widget.cancelByCode(slug, code);
  }
}
