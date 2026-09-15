// Доменные типы UI и форматтеры. Данные приходят из Saba API (см. store.tsx).

export type AppointmentStatus = 'pending' | 'confirmed' | 'in_progress' | 'done' | 'paid' | 'cancelled' | 'no_show';
export type PaymentMethod = 'cash' | 'kaspi_qr' | 'kaspi_transfer' | 'card';
export type CarSize = 'S' | 'M' | 'L' | 'XL';

export interface Box {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  orderIndex: number;
}

export interface Service {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  priceBySize: Record<CarSize, number>;
}

export interface Client {
  id: string;
  phone: string;
  name: string;
  carBrand: string;
  carNumber: string;
  totalVisits: number;
  totalSpent: number;
  lastVisitAt: string;
  notes: string;
}

export interface Employee {
  id: string;
  name: string;
  role: 'master' | 'admin';
  salaryType: 'percent' | 'fixed' | 'combo';
  salaryValue: number;
}

// Снимок клиента, встроенный в ответ API по записи (приходит из /appointments).
// Нужен, чтобы карточка записи показывала имя/телефон даже когда клиента ещё нет
// в отдельно загруженном списке store.clients (свежая запись, роль «мастер»).
export interface AppointmentClient {
  id: string;
  name: string;
  phone: string;
  carBrand: string;
  carNumber: string;
}

export interface Appointment {
  id: string;
  boxId: string;
  clientId: string;
  masterId: string;
  serviceId: string;
  startAt: string; // HH:mm
  endAt: string;
  status: AppointmentStatus;
  price: number;
  paymentMethod?: PaymentMethod;
  source: 'admin_panel' | 'online_widget' | 'phone';
  notes?: string;
  client?: AppointmentClient;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;     // локализованная подпись для отображения
  actionKey: string;  // сырая категория действия для фильтрации (status:* → 'status')
  entity: string;
  oldValue: string;
  newValue: string;
  ip: string;
  isSuspicious: boolean;
}

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: '#94A3B8',
  confirmed: '#3B82F6',
  in_progress: '#F59E0B',
  done: '#10B981',
  paid: '#059669',
  cancelled: '#EF4444',
  no_show: '#F97316',
};

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Ожидание',
  confirmed: 'Подтверждено',
  in_progress: 'В работе',
  done: 'Выполнено',
  paid: 'Оплачено',
  cancelled: 'Отменено',
  no_show: 'Неявка',
};

export function formatPrice(price: number): string {
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₸';
}

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return `**** ** ${phone.slice(-2)}`;
}

// ——— Локализация журнала аудита ———

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  impersonate: 'Вход супер-админа',
  reset_password: 'Сброс пароля',
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  price_change: 'Изменение цены',
  reschedule: 'Перенос записи',
  register: 'Регистрация',
  set_price_code: 'Установка кода цен',
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  client: 'Клиент',
  appointment: 'Запись',
  employee: 'Сотрудник',
  box: 'Бокс',
  service: 'Услуга',
  salary_rule: 'Правило зарплаты',
  company: 'Компания',
  car_sizes: 'Размеры авто',
};

export const AUDIT_FIELD_LABELS: Record<string, string> = {
  name: 'Название',
  email: 'Почта',
  phone: 'Телефон',
  type: 'Тип',
  price: 'Цена',
  priceBySize: 'Цены по размеру',
  category: 'Категория',
  durationMin: 'Длительность',
  active: 'Активность',
  color: 'Цвет',
  sortOrder: 'Порядок',
  status: 'Статус',
  businessType: 'Тип бизнеса',
  address: 'Адрес',
  city: 'Город',
  timezone: 'Часовой пояс',
  language: 'Язык',
  accentColor: 'Цвет акцента',
  workingHours: 'Часы работы',
  settings: 'Настройки',
  wizardStep: 'Шаг настройки',
  wizardDone: 'Настройка завершена',
  boxId: 'Бокс',
  startAt: 'Начало',
  plan: 'Тариф',
  trial: 'Пробный период',
  cancelReason: 'Причина отмены',
  fields: 'Поля',
  oldPrice: 'Старая цена',
  newPrice: 'Новая цена',
};

const SALARY_TYPE_LABELS: Record<string, string> = {
  percent: 'процент',
  fixed: 'фиксированная',
  combo: 'комбинированная',
};

/** Человекочитаемое действие аудита (включая переходы статуса status:from->to). */
export function formatAuditAction(action: string): string {
  if (action?.startsWith('status:')) {
    const [from, to] = action.slice(7).split('->');
    const f = STATUS_LABELS[from as AppointmentStatus] ?? from;
    const t = STATUS_LABELS[to as AppointmentStatus] ?? to;
    return `Статус: ${f} → ${t}`;
  }
  return AUDIT_ACTION_LABELS[action] ?? action;
}

/** Ключ-категория действия для фильтрации (status:* → 'status'). */
export function auditActionKey(action: string): string {
  return action?.startsWith('status:') ? 'status' : action;
}

function formatAuditFieldValue(key: string, value: unknown): string {
  if (value === true) return 'да';
  if (value === false) return 'нет';
  if (value == null) return '—';
  if (key === 'type') return SALARY_TYPE_LABELS[String(value)] ?? String(value);
  if (key === 'status') return STATUS_LABELS[value as AppointmentStatus] ?? String(value);
  if (Array.isArray(value)) return value.map((v) => AUDIT_FIELD_LABELS[String(v)] ?? String(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Человекочитаемое значение «Стало» из details записи аудита. */
export function formatAuditValue(details: Record<string, unknown>): string {
  const keys = Object.keys(details || {});
  if (keys.length === 0) return '';
  // создание объекта с одним полем-именем → показываем само значение
  if (keys.length === 1 && keys[0] === 'name') return String(details.name);
  // список изменённых полей
  if (keys.length === 1 && keys[0] === 'fields' && Array.isArray(details.fields)) {
    return 'Изменены: ' + (details.fields as string[]).map((f) => AUDIT_FIELD_LABELS[f] ?? f).join(', ');
  }
  const out = keys
    .map((k) => `${AUDIT_FIELD_LABELS[k] ?? k}: ${formatAuditFieldValue(k, details[k])}`)
    .join(', ');
  return out.length > 90 ? out.slice(0, 89) + '…' : out;
}
