import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

const GRAPH_VERSION = 'v23.0';

export interface TemplateComponent {
  type: 'body' | 'header' | 'button';
  sub_type?: string;
  index?: string;
  parameters: { type: 'text'; text: string }[];
}

/**
 * Клиент WhatsApp Cloud API (Meta). Один системный номер Saba на всю
 * платформу — так и задумано в ТЗ, у тенантов своих номеров нет.
 *
 * Без переменных окружения сервис считается невключённым: isConfigured()
 * вернёт false, и вызывающий код останется на прежнем поведении (заглушка
 * напоминаний, devCode в OTP). Это позволяет катить код до того, как
 * появятся доступы Meta.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  private readonly appSecret = process.env.WHATSAPP_APP_SECRET ?? '';
  private readonly lang = process.env.WHATSAPP_LANG ?? 'ru';

  readonly verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? '';
  readonly otpTemplate = process.env.WHATSAPP_TEMPLATE_OTP ?? 'saba_otp';
  readonly reminderTemplate = process.env.WHATSAPP_TEMPLATE_REMINDER ?? 'saba_reminder';

  isConfigured(): boolean {
    return Boolean(this.phoneNumberId && this.accessToken);
  }

  /** Meta ждёт номер без «+» и без разделителей. */
  static normalize(phone: string): string {
    return phone.replace(/[^\d]/g, '');
  }

  /**
   * Проверка подписи вебхука (X-Hub-Signature-256 = HMAC-SHA256 по сырому телу).
   * Без app secret проверить нечем — считаем запрос недоверенным.
   */
  verifySignature(rawBody: Buffer | undefined, header: string | undefined): boolean {
    if (!this.appSecret || !rawBody || !header?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', this.appSecret).update(rawBody).digest();
    const received = Buffer.from(header.slice(7), 'hex');
    if (received.length !== expected.length) return false;
    return timingSafeEqual(expected, received);
  }

  private async post(body: unknown): Promise<{ messageId: string }> {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data?.error ?? {};
      // code/message от Meta полезны в логе: 131047 — вне 24ч-окна, 132001 — нет шаблона
      throw new Error(`WhatsApp ${res.status}: ${err.code ?? '?'} ${err.message ?? 'unknown error'}`);
    }
    return { messageId: data?.messages?.[0]?.id ?? '' };
  }

  /** Шаблонное сообщение — единственный способ написать первым (вне 24ч-окна). */
  async sendTemplate(
    phone: string,
    template: string,
    components: TemplateComponent[],
  ): Promise<{ messageId: string }> {
    return this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: WhatsappService.normalize(phone),
      type: 'template',
      template: {
        name: template,
        language: { code: this.lang },
        ...(components.length ? { components } : {}),
      },
    });
  }

  /**
   * Код подтверждения authentication-шаблоном. Meta требует передать код
   * дважды: в теле и в кнопке copy-code — иначе кнопка скопирует пустоту.
   */
  async sendOtp(phone: string, code: string): Promise<{ messageId: string }> {
    return this.sendTemplate(phone, this.otpTemplate, [
      { type: 'body', parameters: [{ type: 'text', text: code }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
    ]);
  }

  /** Свободный текст — только внутри 24ч после сообщения клиента. */
  async sendText(phone: string, text: string): Promise<{ messageId: string }> {
    return this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: WhatsappService.normalize(phone),
      type: 'text',
      text: { preview_url: false, body: text },
    });
  }
}
