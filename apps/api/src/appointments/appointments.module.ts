import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentsCron } from './appointments.cron';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsCron],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
