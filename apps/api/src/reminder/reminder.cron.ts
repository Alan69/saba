import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReminderService } from './reminder.service';

@Injectable()
export class ReminderCron {
  constructor(private readonly reminders: ReminderService) {}

  /** Каждые 5 минут проверяем, кому пора напомнить о визите (Этап 6). */
  @Cron('*/5 * * * *')
  async run() {
    await this.reminders.dispatchDue();
  }
}
