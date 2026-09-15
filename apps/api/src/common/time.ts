/**
 * Возвращает UTC-границы локального дня [start, end) для таймзоны компании.
 */
export function dayRangeUtc(dateISO: string, timezone: string): { start: Date; end: Date } {
  const offsetMin = tzOffsetMinutes(new Date(`${dateISO}T12:00:00Z`), timezone);
  const startLocalMs = Date.parse(`${dateISO}T00:00:00Z`) - offsetMin * 60_000;
  return { start: new Date(startLocalMs), end: new Date(startLocalMs + 24 * 3600 * 1000) };
}

export function tzOffsetMinutes(date: Date, timezone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** 'HH:MM' локального времени для даты в таймзоне */
export function localTimeToUtc(dateISO: string, time: string, timezone: string): Date {
  const offsetMin = tzOffsetMinutes(new Date(`${dateISO}T12:00:00Z`), timezone);
  return new Date(Date.parse(`${dateISO}T${time}:00Z`) - offsetMin * 60_000);
}

export function weekdayKey(date: Date, timezone: string): string {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' })
    .format(date)
    .toLowerCase();
  return wd.slice(0, 3); // mon, tue, ...
}
