import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from '../whatsapp/whatsapp.service';

export interface ReminderPayload {
  appointmentId: string;
  code: string;
  startAt: Date;
  companyName: string;
  serviceName: string | null;
  clientName: string | null;
  phone: string | null;
  email: string | null;
}

/**
 * Абстракция канала доставки напоминаний (Этап 6).
 * Реальный канал (WhatsApp/SMS/Email) подключается заменой провайдера в ReminderModule.
 */
export abstract class ReminderSender {
  abstract send(payload: ReminderPayload): Promise<void>;
}

/** Заглушка: ничего не отправляет, только логирует. По умолчанию. */
@Injectable()
export class NoopReminderSender extends ReminderSender {
  private readonly logger = new Logger('ReminderSender');

  async send(p: ReminderPayload): Promise<void> {
    this.logger.log(
      `[noop] Напоминание ${p.code} → ${p.clientName ?? p.phone ?? p.email ?? '—'} ` +
        `на ${p.startAt.toISOString()} (${p.serviceName ?? 'услуга'}, ${p.companyName})`,
    );
  }
}

/** Реальный канал: шаблонное сообщение WhatsApp на номер клиента. */
@Injectable()
export class WhatsappReminderSender extends ReminderSender {
  private readonly logger = new Logger('ReminderSender');

  constructor(private readonly whatsapp: WhatsappService) {
    super();
  }

  async send(p: ReminderPayload): Promise<void> {
    if (!p.phone) {
      this.logger.warn(`Напоминание ${p.code}: у клиента нет телефона, пропуск`);
      return;
    }
    const when = p.startAt.toLocaleString('ru-RU', {
      timeZone: 'Asia/Almaty',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    // Порядок параметров обязан совпадать с {{1}}..{{4}} в шаблоне saba_reminder
    const { messageId } = await this.whatsapp.sendTemplate(p.phone, this.whatsapp.reminderTemplate, [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: p.companyName },
          { type: 'text', text: when },
          { type: 'text', text: p.serviceName ?? 'услуга' },
          { type: 'text', text: p.code },
        ],
      },
    ]);
    this.logger.log(`Напоминание ${p.code} → ${p.phone}, wamid ${messageId}`);
  }
}
