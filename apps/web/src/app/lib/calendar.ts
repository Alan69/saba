// Генерация ссылок и .ics-файла для добавления записи в календарь.
// Чисто клиентская утилита — без обращений к бэкенду.

export interface CalendarEvent {
  title: string;
  /** ISO-строка момента начала (UTC) */
  start: string;
  durationMin: number;
  location?: string;
  description?: string;
}

/** Преобразует Date в формат iCalendar/Google: YYYYMMDDTHHMMSSZ (UTC). */
function toCalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function eventRange(ev: CalendarEvent): { start: Date; end: Date } {
  const start = new Date(ev.start);
  const end = new Date(start.getTime() + ev.durationMin * 60_000);
  return { start, end };
}

/** Ссылка на добавление события в веб-версию Google Календаря. */
export function googleCalendarUrl(ev: CalendarEvent): string {
  const { start, end } = eventRange(ev);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${toCalDate(start)}/${toCalDate(end)}`,
  });
  if (ev.description) params.set('details', ev.description);
  if (ev.location) params.set('location', ev.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Экранирование текстовых полей по RFC 5545. */
function escapeICS(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Содержимое .ics-файла (Apple Calendar, Outlook, календарь телефона). */
export function buildIcs(ev: CalendarEvent, uid: string): string {
  const { start, end } = eventRange(ev);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Saba//Booking//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toCalDate(new Date())}`,
    `DTSTART:${toCalDate(start)}`,
    `DTEND:${toCalDate(end)}`,
    `SUMMARY:${escapeICS(ev.title)}`,
  ];
  if (ev.location) lines.push(`LOCATION:${escapeICS(ev.location)}`);
  if (ev.description) lines.push(`DESCRIPTION:${escapeICS(ev.description)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

/** Скачивает .ics-файл — на телефоне открывает диалог добавления в календарь. */
export function downloadIcs(ev: CalendarEvent, uid: string, filename = 'event.ics'): void {
  const blob = new Blob([buildIcs(ev, uid)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
