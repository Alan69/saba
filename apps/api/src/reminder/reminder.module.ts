import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReminderService } from './reminder.service';
import { ReminderCron } from './reminder.cron';
import { ReminderSender, NoopReminderSender, WhatsappReminderSender } from './reminder-sender';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Module({
  imports: [PrismaModule],
  providers: [
    ReminderService,
    ReminderCron,
    // Канал доставки: WhatsApp, если заданы доступы Meta, иначе заглушка в лог.
    {
      provide: ReminderSender,
      inject: [WhatsappService],
      useFactory: (whatsapp: WhatsappService) =>
        whatsapp.isConfigured() ? new WhatsappReminderSender(whatsapp) : new NoopReminderSender(),
    },
  ],
  exports: [ReminderService],
})
export class ReminderModule {}
