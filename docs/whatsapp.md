# WhatsApp Cloud API

Один системный номер Saba на всю платформу — у тенантов своих номеров нет.
Отправка идёт из `WhatsappService`, потребителей два:

| Где | Шаблон | Когда |
|-----|--------|-------|
| `ClientService.sendOtp` | `saba_otp` (AUTHENTICATION) | вход в клиентский портал |
| `WhatsappReminderSender` | `saba_reminder` (UTILITY) | напоминание о записи, cron |

Пока `WHATSAPP_PHONE_NUMBER_ID` и `WHATSAPP_ACCESS_TOKEN` пустые, интеграция
выключена: напоминания пишутся в лог, OTP возвращается в ответе (`devCode`).
Как только доступы появляются, `devCode` из выдачи пропадает.

## Что взять в дашборде Meta

Приложение `904072509405407` → **WhatsApp → API Setup**:

| Переменная | Где взять |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID под выбранным номером |
| `WHATSAPP_ACCESS_TOKEN` | **не** временный токен из API Setup (живёт 24 ч), а постоянный токен System User: Business Settings → Users → System Users → Generate token, права `whatsapp_business_messaging` и `whatsapp_business_management` |
| `WHATSAPP_APP_SECRET` | Settings → Basic → App Secret |
| `WHATSAPP_VERIFY_TOKEN` | придумывается самостоятельно, вписывается и в `.env`, и в поле Verify token при настройке вебхука |

## Вебхук

Callback URL: `https://sabasmart.app/api/v1/whatsapp/webhook`

Подписаться на поля `messages` (статусы доставки + входящие). Подпись
каждого запроса проверяется по `X-Hub-Signature-256`, поэтому без верного
`WHATSAPP_APP_SECRET` вебхук будет отвечать 403.

## Шаблоны

Написать первым можно только утверждённым шаблоном — свободный текст
разрешён лишь 24 часа после сообщения клиента. Создаются в
**WhatsApp Manager → Message templates**, язык `ru`.

**`saba_otp`** — категория Authentication, кнопка **Copy code**, срок
действия 10 минут. Текст у таких шаблонов преднастроенный, менять его
нельзя. Код уходит в payload дважды — в теле и в кнопке, иначе кнопка
скопирует пустоту.

**`saba_reminder`** — категория Utility, тело:

```
Напоминаем о записи в {{1}}: {{2}}. Услуга: {{3}}. Код записи: {{4}}.
```

Порядок параметров жёстко завязан на код в `reminder-sender.ts`:
компания, дата и время, услуга, код записи. Если в шаблоне поменять
местами `{{1}}`..`{{4}}`, сообщения поедут — менять надо синхронно.

## Ограничения, о которые спотыкаются

- Непроверенный бизнес — лимит 250 диалогов в сутки и только тестовый номер.
  Снимается через Business Verification.
- Шаблон уходит на модерацию: обычно минуты, иногда часы. Отклонённый
  шаблон переписывается и подаётся заново.
- Коды ошибок в логе: `131047` — вне 24-часового окна (нужен шаблон),
  `132001` — шаблона с таким именем/языком нет, `131026` — номер получателя
  не в WhatsApp.

## Самопроверка

```bash
npm run check:whatsapp -w apps/api
```

Сеть не трогает: проверяет нормализацию номера, подпись вебхука и то, что
в OTP-payload код попадает дважды.

## Диагностика

Если сообщения не уходят — не гадайте по интерфейсу, спросите Meta напрямую.
`health_status` перечисляет каждую сущность (номер, WABA, бизнес, приложение)
с кодом и текстом проблемы:

```bash
cd /opt/saba && set -a && . ./.env && set +a
curl -s -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" \
  "https://graph.facebook.com/v25.0/$WHATSAPP_PHONE_NUMBER_ID?fields=health_status" \
  | python3 -m json.tool
```

Коды, которые встречались при подключении:

| Код | Что значит | Что делать |
|-----|-----------|-----------|
| `141000` | номер не привязан к WhatsApp-аккаунту | `POST /{phone-number-id}/register` с 6-значным PIN |
| `141008` | WABA не активен | обычно нет валидного способа оплаты — починить биллинг в WhatsApp Manager |
| `141010` | бизнес не прошёл верификацию | Business Settings → Security Center, лимит до этого — 250 диалогов в сутки |
| `2388185` | WABA не даёт создавать шаблоны | следствие `141008` |
| `138024`, `138025` | SIP для звонков не настроен | к сообщениям отношения не имеет, игнорировать |

## Порядок подключения номера

Верификация кодом из SMS и регистрация в Cloud API — **разные шаги**, и в
интерфейсе это неочевидно. После SMS номер получает
`code_verification_status: VERIFIED`, но остаётся в `status: PENDING` и не
может отправлять. Нужен ещё один вызов:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "https://graph.facebook.com/v25.0/$PHONE_NUMBER_ID/register" \
  -d '{"messaging_product":"whatsapp","pin":"<6 цифр>"}'
```

После него `status: CONNECTED`, `platform_type: CLOUD_API`. PIN — это
двухфакторка номера, хранится вне репозитория; при переносе номера на другой
сервер он понадобится.

Приложение также надо подписать на события WABA, иначе вебхук не получит
ничего, даже будучи настроенным:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://graph.facebook.com/v25.0/$WABA_ID/subscribed_apps"
```
