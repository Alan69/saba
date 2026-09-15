import { Injectable, Logger } from '@nestjs/common';

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
