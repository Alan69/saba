import { Body, Controller, Get, HttpCode, Logger, Post, Query, Req, ForbiddenException } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { Public } from '../common/jwt-auth.guard';

/**
 * Вебхук Meta. Адрес для настройки в дашборде приложения:
 *   https://sabasmart.app/api/v1/whatsapp/webhook
 */
@Public()
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsapp: WhatsappService) {}

  /** Разовая верификация адреса: Meta ждёт hub.challenge в теле ответа. */
  @Get('webhook')
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    if (mode === 'subscribe' && token && token === this.whatsapp.verifyToken) {
      this.logger.log('Вебхук подтверждён Meta');
      return challenge ?? '';
    }
    throw new ForbiddenException('Неверный verify token');
  }

  /**
   * События: статусы доставки исходящих и входящие сообщения.
   * Отвечать нужно 200 в любом случае, иначе Meta ретраит и в итоге
   * отключает подписку. Поэтому всё, кроме неверной подписи, глотаем.
   */
  @Post('webhook')
  @HttpCode(200)
  receive(@Req() req: any, @Body() body: any): string {
    if (!this.whatsapp.verifySignature(req.rawBody, req.headers['x-hub-signature-256'])) {
      throw new ForbiddenException('Неверная подпись');
    }

    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const v = change?.value ?? {};
        for (const s of v.statuses ?? []) {
          // sent → delivered → read, либо failed с причиной
          const err = s.errors?.[0];
          this.logger.log(
            `Статус ${s.id}: ${s.status}${err ? ` — ${err.code} ${err.title}` : ''}`,
          );
        }
        for (const m of v.messages ?? []) {
          this.logger.log(`Входящее от ${m.from}: ${m.type}`);
        }
      }
    }
    return 'ok';
  }
}
