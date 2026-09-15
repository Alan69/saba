// Чистая логика календаря и слотов (без React) — легко тестируется.
import type { Slot, WorkingDay } from '../types';

// getDay(): 0=Вс … 6=Сб → ключи часов работы компании
const WD_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export type SlotGroups = { morning: Slot[]; day: Slot[]; evening: Slot[] };

/** Группировка слотов по времени суток: Утро <12:00, День 12–17, Вечер ≥17. */
export function groupSlots(slots: Slot[]): SlotGroups {
  const groups: SlotGroups = { morning: [], day: [], evening: [] };
  for (const s of slots) {
    const hour = Number(s.time.slice(0, 2));
    if (hour < 12) groups.morning.push(s);
    else if (hour < 17) groups.day.push(s);
    else groups.evening.push(s);
  }
  return groups;
}

/** Закрыта ли компания в этот день недели (по часам работы). */
export function isCompanyClosed(date: Date, workingHours?: Record<string, WorkingDay>): boolean {
  if (!workingHours) return false;
  const wd = workingHours[WD_KEYS[date.getDay()]];
  return wd ? wd.enabled === false : false;
}

/** День строго раньше сегодняшнего. */
export function isPastDay(date: Date, today: Date): boolean {
  const d = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return d < t;
}

/** Недоступный день: прошлый или компания закрыта. */
export function isDayDisabled(date: Date, today: Date, workingHours?: Record<string, WorkingDay>): boolean {
  return isPastDay(date, today) || isCompanyClosed(date, workingHours);
}

/** Сетка месяца: недели по 7 ячеек, неделя с понедельника, null = пусто. */
export function monthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Пн = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function toISODate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function sameISODate(d: Date, iso: string | null): boolean {
  return iso != null && toISODate(d) === iso;
}
