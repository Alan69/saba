import { CarSize } from '@prisma/client';

export interface CarSizeConfig {
  key: CarSize;
  label: string;
  examples: string;
  enabled: boolean;
}

/** Дефолтные типы авто, если мойка не настроила свои (ТЗ: цена зависит от размера) */
export const DEFAULT_CAR_SIZES: CarSizeConfig[] = [
  { key: 'S', label: 'Седан', examples: 'Toyota Camry, Kia Cerato', enabled: true },
  { key: 'M', label: 'Кроссовер', examples: 'Hyundai Tucson, Kia Sportage', enabled: true },
  { key: 'L', label: 'Внедорожник', examples: 'Toyota Land Cruiser, Lexus LX', enabled: true },
  { key: 'XL', label: 'Минивен', examples: 'Toyota Alphard, Kia Carnival', enabled: true },
];

/** Берёт настроенные размеры из company.settings или отдаёт дефолт */
export function resolveCarSizes(settings: unknown): CarSizeConfig[] {
  const raw = (settings as Record<string, unknown> | null)?.carSizes;
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_CAR_SIZES;
  const byKey = new Map(raw.map((r: any) => [r.key, r]));
  // гарантируем все 4 ключа enum в фиксированном порядке
  return DEFAULT_CAR_SIZES.map((def) => {
    const o = byKey.get(def.key);
    return o
      ? {
          key: def.key,
          label: typeof o.label === 'string' && o.label ? o.label : def.label,
          examples: typeof o.examples === 'string' ? o.examples : def.examples,
          enabled: o.enabled !== false,
        }
      : def;
  });
}
