// Валидация и нормализация контактных данных.

/** Приводит телефон к виду +7XXXXXXXXXX (как ожидает бэкенд). */
export function normalizePhone(raw: string): string {
  const clean = raw.replace(/[^\d+]/g, '');
  if (!clean) return '';
  return clean.startsWith('+') ? clean : `+7${clean.replace(/^[78]/, '')}`;
}

export function isValidPhone(raw: string): boolean {
  return raw.replace(/[^\d]/g, '').length >= 10;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
