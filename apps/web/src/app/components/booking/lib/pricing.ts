// Расчёт цены услуги с учётом мастера (Этап 3) и размера авто.
import { formatPrice, type CarSize } from '../../../lib/mock-data';
import type { EmployeePrice, WidgetService } from '../types';

export function basePrice(svc: WidgetService, carSize: CarSize | null): number {
  return Number((carSize && svc.priceBySize?.[carSize]) ?? svc.price);
}

/** Цена для конкретного мастера (если есть переопределение), иначе базовая. */
export function effectivePrice(
  svc: WidgetService,
  specialistId: string,
  carSize: CarSize | null,
  prices: EmployeePrice[],
): number {
  if (specialistId !== 'any') {
    const o = prices.find((p) => p.employeeId === specialistId && p.serviceId === svc.id);
    if (o) return o.price;
  }
  return basePrice(svc, carSize);
}

function range(svc: WidgetService, carSize: CarSize | null, prices: EmployeePrice[]): { min: number; max: number } {
  const all = [basePrice(svc, carSize), ...prices.filter((p) => p.serviceId === svc.id).map((p) => p.price)];
  return { min: Math.min(...all), max: Math.max(...all) };
}

function groupDigits(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** "7 000 ₸" для выбранного мастера; "7 000 – 8 000 ₸" — диапазон по мастерам. */
export function formatServicePrice(
  svc: WidgetService,
  specialistId: string,
  carSize: CarSize | null,
  prices: EmployeePrice[],
): string {
  if (specialistId !== 'any') return formatPrice(effectivePrice(svc, specialistId, carSize, prices));
  const { min, max } = range(svc, carSize, prices);
  return min === max ? formatPrice(min) : `${groupDigits(min)} – ${formatPrice(max)}`;
}
