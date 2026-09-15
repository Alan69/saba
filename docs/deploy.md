# Деплой Saba

Прод: **http://82.115.49.205** (VPS `saba-prod`, Ubuntu 24.04, выделен под
проект). Стек целиком в Docker: postgres, redis, api, web. Наружу торчит
только `web` — nginx внутри контейнера слушает 80 и раздаёт SPA с корня,
`/api/` проксирует на `api:3001`.

## Первый запуск на чистом сервере

```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER   # перелогиниться
sudo install -d -o $USER -g $USER /opt/saba
git clone https://github.com/Alan69/saba.git /opt/saba && cd /opt/saba

umask 077
printf 'POSTGRES_USER=saba\nPOSTGRES_PASSWORD=%s\nPOSTGRES_DB=saba\nJWT_SECRET=%s\n' \
  "$(openssl rand -hex 24)" "$(openssl rand -hex 32)" > .env

docker compose -f docker-compose.prod.yml -p saba up -d --build
```

Миграции Prisma накатываются автоматически при старте контейнера `api`.

## Обновить

```bash
cd /opt/saba && git pull && docker compose -f docker-compose.prod.yml -p saba up -d --build
```

## Супер-админ

Роль `superadmin` живёт в служебной компании `saba-platform` — в списке
тенантов её нет. Создать нового или сменить пароль существующему:

```bash
cd /opt/saba && docker compose -p saba exec \
  -e SUPERADMIN_PHONE=+7700... -e SUPERADMIN_PASSWORD=... api npm run superadmin
```

Скрипт идемпотентный: тот же телефон — перезапись пароля, новый — ещё один
супер-админ.

Панель: `/admin` — компании (режим active/read_only/frozen, тариф, срок),
аналитика за 30 дней, сквозной аудит, вход под компанией, сброс пароля
владельца, soft-delete.

## Чего нет

HTTPS: домена нет, а на голый IP сертификат не выпустить. Появится домен —
ставим Caddy перед `web`, он сам возьмёт Let's Encrypt.

## Секреты

`/opt/saba/.env` (chmod 600) — пароль Postgres и `JWT_SECRET`, генерируются
на сервере, в репозиторий не попадают.
