/**
 * Самопроверка клиента WhatsApp: запуск `npm run check:whatsapp -w apps/api`.
 * Сеть не трогает — fetch подменяется заглушкой.
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
process.env.WHATSAPP_ACCESS_TOKEN = 'token';
process.env.WHATSAPP_APP_SECRET = 'secret';
process.env.WHATSAPP_LANG = 'ru';

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { WhatsappService } from '../src/whatsapp/whatsapp.service';

const sign = (body: string) =>
  'sha256=' + createHmac('sha256', 'secret').update(Buffer.from(body)).digest('hex');

async function main() {
  const wa = new WhatsappService();

  assert.equal(wa.isConfigured(), true, 'с полным окружением сервис включён');
  assert.equal(WhatsappService.normalize('+7 701 123-45-67'), '77011234567', 'номер чистится от разделителей');

  // — подпись вебхука —
  const body = '{"entry":[]}';
  assert.equal(wa.verifySignature(Buffer.from(body), sign(body)), true, 'верная подпись принимается');
  assert.equal(
    wa.verifySignature(Buffer.from('{"entry":[1]}'), sign(body)),
    false,
    'подменённое тело отбрасывается',
  );
  assert.equal(wa.verifySignature(Buffer.from(body), 'sha256=00'), false, 'короткая подпись отбрасывается');
  assert.equal(wa.verifySignature(Buffer.from(body), undefined), false, 'без заголовка — отказ');
  assert.equal(wa.verifySignature(undefined, sign(body)), false, 'без сырого тела — отказ');

  // — payload OTP: Meta требует код и в теле, и в кнопке —
  let captured: any;
  global.fetch = (async (_url: string, init: any) => {
    captured = JSON.parse(init.body);
    return { ok: true, json: async () => ({ messages: [{ id: 'wamid.TEST' }] }) };
  }) as any;

  const { messageId } = await wa.sendOtp('+7 701 123-45-67', '482913');
  assert.equal(messageId, 'wamid.TEST', 'wamid возвращается наверх');
  assert.equal(captured.to, '77011234567');
  assert.equal(captured.template.language.code, 'ru');
  const codes = captured.template.components.map((c: any) => c.parameters[0].text);
  assert.deepEqual(codes, ['482913', '482913'], 'код передан дважды: тело + кнопка copy-code');
  assert.equal(captured.template.components[1].sub_type, 'url', 'кнопка помечена как url');

  // — ошибка Meta должна всплывать, а не проглатываться —
  global.fetch = (async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: { code: 132001, message: 'Template name does not exist' } }),
  })) as any;
  await assert.rejects(
    () => wa.sendOtp('+77011234567', '111111'),
    /132001/,
    'код ошибки Meta попадает в сообщение',
  );

  // — без доступов сервис выключен —
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  assert.equal(new WhatsappService().isConfigured(), false, 'без токена сервис не включается');

  console.log('whatsapp: все проверки пройдены');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
