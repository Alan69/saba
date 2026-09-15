// Выбранные услуги записи и агрегаты (Этап 5).
import type { CarSize } from '../../../lib/mock-data';
import type { BookingDraft, EmployeePrice, WidgetInfo, WidgetService } from '../types';
import { effectivePrice } from './pricing';

export function selectedServices(info: WidgetInfo, draft: BookingDraft): WidgetService[] {
  return draft.serviceIds
    .map((id) => info.services.find((s) => s.id === id))
    .filter((s): s is WidgetService => Boolean(s));
}

export function totalDuration(services: WidgetService[]): number {
  return services.reduce((sum, s) => sum + s.durationMin, 0);
}

export function totalPrice(
  services: WidgetService[],
  specialistId: string,
  carSize: CarSize | null,
  prices: EmployeePrice[],
): number {
  return services.reduce((sum, s) => sum + effectivePrice(s, specialistId, carSize, prices), 0);
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

/** "услуга" / "услуги" / "услуг" */
export function servicesWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'услуга';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'услуги';
  return 'услуг';
}
