// Типы публичного виджета записи (Altegio-style flow, Этап 1).
import type { CarSize } from '../../lib/mock-data';

export type Screen = 'hub' | 'services' | 'specialist' | 'datetime' | 'details';

export interface Specialist {
  id: string;
  name: string;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  rating?: number | null;
  reviewCount?: number;
}

export interface EmployeePrice {
  employeeId: string;
  serviceId: string;
  price: number;
}

export interface WidgetService {
  id: string;
  name: string;
  category?: string | null;
  durationMin: number;
  price: number;
  priceBySize?: Partial<Record<CarSize, number>> | null;
}

export interface CarSizeOption {
  key: CarSize;
  label: string;
  examples: string;
}

export interface WorkingDay {
  enabled?: boolean;
  start?: string;
  end?: string;
}

export interface WidgetInfo {
  name: string;
  slug: string;
  businessType: string;
  address?: string;
  phone?: string;
  accentColor?: string;
  workingHours?: Record<string, WorkingDay>;
  termsUrl?: string | null;
  privacyUrl?: string | null;
  poweredBy: boolean;
  carSizes?: CarSizeOption[];
  specialists?: Specialist[];
  employeePrices?: EmployeePrice[];
  services: WidgetService[];
}

export interface Slot {
  startAt: string;
  time: string; // HH:mm
  boxIds: string[];
}

export interface ContactInfo {
  name: string;
  phone: string;
  email: string;
  comment: string;
}

export interface BookingDraft {
  serviceIds: string[];
  carSize: CarSize | null;
  specialistId: string; // 'any' в Этапе 1; реальный мастер — Этап 2
  date: string | null; // yyyy-mm-dd
  slot: { startAt: string; boxId: string; time: string } | null;
  contact: ContactInfo;
  reminderMinutes: number;
  consent: boolean;
}

export const REMINDER_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 0, label: 'Без напоминания' },
  { minutes: 60, label: 'За 1 час до визита' },
  { minutes: 180, label: 'За 3 часа до визита' },
  { minutes: 1440, label: 'За 1 день до визита' },
];

/** Автомойки показывают шаг «тип авто»; остальные вертикали — нет. */
export function usesCarSize(businessType?: string): boolean {
  return businessType === 'carwash';
}
