# Altegio-style booking widget — design & 6-phase roadmap

**Date:** 2026-06-29
**Goal:** Rebuild the public booking widget (`apps/web/.../booking-widget.tsx`) to match the Altegio booking flow 1:1, in functionality, delivered across 6 phases. Vertical-aware via `Company.businessType` (car wash keeps the "car size" step; barber/beauty don't).

Reference flow (Altegio barbershop): hub → services (categories + search, multi-select) → specialist (photo, role, rating, per-master price, nearest slots) → full month calendar + slots grouped Утро/День/Вечер → "Детали записи" review with edit pencils → contact form (name, phone, email, comment, reminder, consent) → confirmation.

## Decisions (locked)
- **Vertical-aware:** car-size step shown only when `businessType` is a car wash; barber/beauty skip it. One widget, multiple verticals.
- **Navigation:** free-order hub (Altegio 1:1). A "booking draft" reducer is the single source of truth; sections fillable in any order; "Детали" edits any section.
- **Calendar:** hybrid availability — grey out past days and days the company is closed (from `workingHours`); load slots on day click; show "нет слотов" when fully booked. No per-day month-availability endpoint in Phase 1.

## Phase roadmap (dependency order)
1. **Flow shell** (frontend + micro-backend) — hub, categories+search (single-select in P1), month calendar + grouped slots, details+form, extended form (email/comment/consent/reminder-pref stored). Specialist = "any" stub.
2. **Specialist selection + schedule** — `Employee` fields (avatarUrl, jobTitle, bio, isBookable); expose specialists in `GET /widget/:slug`; `employeeId` in slots/reserve/book; `EmployeeSchedule` model; slots = master schedule ∩ box availability; "Любой специалист".
3. **Per-specialist pricing** — `EmployeeServicePrice` junction; price resolution; price ranges ("7 000 – 8 000 ₸") in service list.
4. **Ratings & reviews** — aggregate `NpsResponse` (avg score + count) per master; stars + review count on specialist cards; "i" info modal.
5. **Multi-service booking** — `AppointmentService` junction; refactor `Appointment.service → services`; sum duration/price. Blast radius: admin schedule, salary engine. Late on purpose.
6. **Reminders** — `Appointment.reminderMinutes`/`reminderMethod` + cron + delivery (channel TBD: WhatsApp/SMS/email).

## Phase 1 design (active)

### Booking draft (reducer)
```
draft = {
  serviceId?, carSize?,        // carSize only for car-wash businessType
  specialistId: 'any',         // P1 fixed; real in P2
  date?, slot?{ startAt, boxId },
  contact{ name, phone, email, comment },
  reminderMinutes = 60,        // stored, not sent (sending = P6)
  consent: boolean,
}
```
Screen router: `hub | services | datetime | details` inside one container.

### Screens
- **Hub** — header (logo/name/address) + 3 entries (services / date-time / specialist). Specialist entry → screen with only "Любой специалист" (P2 stub).
- **Services** — category tabs + search + grouped list. **Single-select** in P1 (backend holds one `serviceId`; multi-select = P5). Sticky bar: chosen service + price + "Далее".
- **Date & time** — month calendar (hybrid greying) + on day click load slots, grouped Утро (<12:00) / День (12:00–17:00) / Вечер (≥17:00), collapsible. Hint "Выберите услугу, чтобы увидеть время" if no service yet (slot duration depends on service).
- **Details** — review (specialist/date-time/service + total) each with edit pencil → jump to section; below: form (name*, phone*, email, comment, reminder select, consent checkbox + policy links, total, "Записаться").
- **Confirmation** — keep existing success screen (code, summary, add-to-calendar, личный кабинет).

### Backend micro-additions (P1)
- `GET /widget/:slug` also returns `businessType`, `workingHours`, `termsUrl`, `privacyUrl` (from company settings; empty → consent text without links).
- `Appointment.reminderMinutes Int?` column (migration) + accepted in `book()` (stored only).
- `book()` already supports `comment`/`waConsent`; frontend starts sending them.

### Out of scope for P1
Multi-service, real specialist selection, per-master price/schedule, ratings, actual reminder delivery — all later phases.

### Files
`apps/web/src/app/components/booking/` → `BookingWidget.tsx` (container+reducer), `useBookingDraft.ts`, `screens/{Hub,Services,DateTime,Details,Confirmation}.tsx`, `lib/slots.ts` (group slots, disabled days). Replaces current `booking-widget.tsx`.

### Tests
Add vitest to `apps/web`; cover pure logic: draft reducer, slot grouping, disabled-day calc, form validation.

## Constraints / blockers
- DB/stack not running locally → migrations & e2e cannot be verified by the agent; user applies migrations (`docker compose up -d` → `prisma migrate deploy`) and runs e2e.
- Phase 6 delivery channel is an open decision (asked when reached).
- Two frontend copies exist (`apps/web` live, root `src/` stale Figma export); only `apps/web` is edited.
