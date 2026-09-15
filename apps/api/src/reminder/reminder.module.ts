import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReminderService } from './reminder.service';
import { ReminderCron } from './reminder.cron';
import { ReminderSender, NoopReminderSender } from './reminder-sender';

@Module({
  imports: [PrismaModule],
  providers: [
    ReminderService,
    ReminderCron,
    // Канал доставки: по умолчанию заглушка. Замените на WhatsApp/SMS/Email-провайдер.
    { provide: ReminderSender, useClass: NoopReminderSender },
  ],
  exports: [ReminderService],
})
export class ReminderModule {}
