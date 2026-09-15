# Деплой Saba

Прод: **https://sabasmart.app** (VPS `saba-prod` на ps.kz, 82.115.49.205,
Ubuntu 24.04, выделен под проект). Стек целиком в Docker: postgres, redis,
api, web, caddy. Наружу смотрит только `caddy` (80/443), он терминирует TLS
и проксирует на `web`; nginx внутри `web` раздаёт SPA с корня, а `/api/`
отправляет на `api:3001`.

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

## Домен и HTTPS

Домен `sabasmart.app` куплен через Google Workspace, DNS хостится в
Squarespace (`nsb1-4.squarespacedns.com`).

Зона `.app` целиком в HSTS-preload-списке браузеров, поэтому HTTP для неё
не работает в принципе — сертификат обязателен. Caddy берёт и продлевает
Let's Encrypt сам, ничего настраивать не нужно.

Записи в Squarespace → DNS Settings:

| Тип | Имя | Значение |
|-----|-----|----------|
| A | @ | 82.115.49.205 |
| A | www | 82.115.49.205 |

Пресет «Squarespace Defaults» (4 A-записи на 198.185.159.x / 198.49.23.x и
CNAME `www` → `ext-sq.squarespace.com`) нужно удалить — он уводит домен на
Squarespace.

**Не трогать**: `MX → smtp.google.com` и `TXT → v=spf1 include:_spf.google.com ~all`.
Это почта Google Workspace, снос этих записей её сломает.

В `deploy/Caddyfile` есть временный блок `http://82.115.49.205` — доступ по
IP на время переезда DNS. После того как домен заработает, его надо
удалить: по HTTP пароль уходит открытым текстом.

## Секреты

`/opt/saba/.env` (chmod 600) — пароль Postgres и `JWT_SECRET`, генерируются
на сервере, в репозиторий не попадают.
