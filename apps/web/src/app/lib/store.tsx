// Store: тот же интерфейс, что и mock-версия, но данные идут из Saba API.
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { toast } from 'sonner';
import {
  type Appointment, type AppointmentStatus, type PaymentMethod,
  type Client, type Box, type Service, type Employee, type AuditEntry,
  type CarSize,
  formatPrice, formatAuditAction, auditActionKey, formatAuditValue, AUDIT_ENTITY_LABELS,
} from './mock-data';
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from './api';
import { useAuth } from './auth';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface CreateBookingInput {
  phone: string;
  clientId?: string;
  clientName?: string;
  carBrand?: string;
  carSize?: CarSize;
  serviceId: string;
  boxId: string;
  time: string; // HH:mm локального дня
  masterId?: string;
  notes?: string;
}

interface StoreState {
  appointments: Appointment[];
  clients: Client[];
  boxes: Box[];
  services: Service[];
  employees: Employee[];
  auditLog: AuditEntry[];
  notifications: Notification[];
  currentDate: string; // YYYY-MM-DD
  setCurrentDate: (date: string) => void;
  loading: boolean;
  // Actions (интерфейс совместим со старым mock-store)
  addAppointment: (apt: Appointment) => void;
  createBooking: (input: CreateBookingInput) => Promise<boolean>;
  updateAppointmentStatus: (
    id: string, status: AppointmentStatus, paymentMethod?: PaymentMethod, reason?: string,
  ) => void;
  deleteAppointment: (id: string) => void;
  addClient: (client: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  addBox: (box: Box) => void;
  updateBox: (id: string, updates: Partial<Box>) => void;
  deleteBox: (id: string) => void;
  addService: (service: Service) => void;
  updateService: (id: string, updates: Partial<Service>) => void;
  deleteService: (id: string) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  addAuditEntry: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void;
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  reload: () => Promise<void>;
}

const StoreContext = createContext<StoreState | null>(null);

const DEFAULT_SIZES: CarSize[] = ['S', 'M', 'L', 'XL'];

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function mapBox(b: any): Box {
  return {
    id: b.id,
    name: b.name,
    color: b.color ?? '#3B82F6',
    isActive: b.status === 'active',
    orderIndex: b.sortOrder ?? 0,
  };
}

function mapService(s: any): Service {
  const base = Number(s.price);
  const bySize = (s.priceBySize ?? {}) as Partial<Record<CarSize, number>>;
  const priceBySize = Object.fromEntries(
    DEFAULT_SIZES.map((sz) => [sz, Number(bySize[sz] ?? base)]),
  ) as Record<CarSize, number>;
  return { id: s.id, name: s.name, durationMin: s.durationMin, price: base, priceBySize };
}

function mapClient(c: any): Client {
  const car = c.cars?.[0];
  return {
    id: c.id,
    phone: c.phone,
    name: c.name ?? '',
    carBrand: car?.brand ?? '',
    carNumber: car?.plateNumber ?? '',
    totalVisits: c.visitsCount ?? 0,
    totalSpent: Number(c.totalSpent ?? 0),
    lastVisitAt: c.lastVisitAt ? String(c.lastVisitAt).slice(0, 10) : '',
    notes: c.notes ?? '',
  };
}

function mapEmployee(e: any): Employee {
  return {
    id: e.id,
    name: e.name,
    role: e.role,
    salaryType: 'percent',
    salaryValue: 0,
  };
}

const SOURCE_MAP: Record<string, Appointment['source']> = {
  admin: 'admin_panel',
  widget: 'online_widget',
  portal: 'phone',
};

function mapAppointment(a: any): Appointment {
  return {
    id: a.id,
    boxId: a.boxId ?? a.box?.id ?? '',
    clientId: a.clientId ?? a.client?.id ?? '',
    masterId: a.employeeId ?? a.employee?.id ?? '',
    serviceId: a.serviceId ?? a.service?.id ?? '',
    startAt: hhmm(a.startAt),
    endAt: hhmm(a.endAt),
    status: a.status,
    price: Number(a.price),
    paymentMethod: a.paymentMethod === 'kaspi' ? 'kaspi_qr' : a.paymentMethod ?? undefined,
    source: SOURCE_MAP[a.source] ?? 'admin_panel',
    notes: a.comment ?? undefined,
    client: a.client
      ? {
          id: a.client.id,
          name: a.client.name ?? '',
          phone: a.client.phone ?? '',
          carBrand: a.clientCar?.brand ?? '',
          carNumber: a.clientCar?.plateNumber ?? '',
        }
      : undefined,
  };
}

function mapAudit(a: any): AuditEntry {
  const d = new Date(a.createdAt);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const details = a.details ?? {};
  const suspicious =
    a.action === 'price_change' && details.newPrice < details.oldPrice ||
    a.action?.includes('->cancelled');
  return {
    id: a.id,
    timestamp: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
    user: a.actorName || 'Система',
    action: formatAuditAction(a.action),
    actionKey: auditActionKey(a.action),
    entity: `${AUDIT_ENTITY_LABELS[a.entity] ?? a.entity}${a.entityId ? ` #${String(a.entityId).slice(0, 8)}` : ''}`,
    oldValue: details.oldPrice != null ? formatPrice(Number(details.oldPrice)) : '',
    newValue: details.newPrice != null ? formatPrice(Number(details.newPrice)) : formatAuditValue(details),
    ip: '-',
    isSuspicious: Boolean(suspicious),
  };
}

const NOTIF_TYPE: Record<string, Notification['type']> = {
  fraud_cancel: 'warning',
  fraud_cancel_series: 'error',
  price_below_original: 'warning',
  client_cancel: 'warning',
  new_booking: 'info',
  trial_warning: 'warning',
  trial_ended: 'error',
};

function mapNotification(n: any): Notification {
  return {
    id: n.id,
    type: NOTIF_TYPE[n.type] ?? 'info',
    title: n.title,
    message: n.message,
    timestamp: hhmm(n.createdAt),
    read: n.isRead,
  };
}

const PAYMENT_MAP: Record<PaymentMethod, string> = {
  cash: 'cash',
  kaspi_qr: 'kaspi',
  kaspi_transfer: 'kaspi',
  card: 'card',
};

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function showError(e: unknown) {
  toast.error(e instanceof ApiError ? e.message : 'Ошибка соединения с сервером');
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clientsList, setClients] = useState<Client[]>([]);
  const [boxesList, setBoxes] = useState<Box[]>([]);
  const [servicesList, setServices] = useState<Service[]>([]);
  const [employeesList, setEmployees] = useState<Employee[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentDate, setCurrentDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);

  const reloadAppointments = useCallback(async (date: string) => {
    try {
      const data = await apiGet(`/appointments?date=${date}`);
      setAppointments(data.map(mapAppointment));
    } catch (e) { /* молча: страница может быть без записей */ }
  }, []);

  const reloadClients = useCallback(async () => {
    try { setClients((await apiGet('/clients')).map(mapClient)); } catch { /* master не имеет доступа */ }
  }, []);

  const reloadCatalog = useCallback(async () => {
    try {
      const [boxes, services, employees] = await Promise.all([
        apiGet('/boxes'), apiGet('/services'), apiGet('/employees'),
      ]);
      setBoxes(boxes.map(mapBox));
      setServices(services.map(mapService));
      let mapped: Employee[] = employees.map(mapEmployee);
      // подтягиваем правила зарплат (Business): процент мастера для страницы «Зарплаты»
      try {
        const rules = await apiGet('/salary/rules');
        mapped = mapped.map((emp) => {
          const rule = rules.find((r: any) => r.employeeId === emp.id && r.active);
          if (!rule) return emp;
          if (rule.type === 'percent') {
            return { ...emp, salaryType: 'percent' as const, salaryValue: Number(rule.config?.percent ?? 0) };
          }
          if (rule.type === 'fixed_month') {
            return { ...emp, salaryType: 'fixed' as const, salaryValue: Number(rule.config?.amount ?? 0) };
          }
          return emp;
        });
      } catch { /* Light-план или не owner */ }
      setEmployees(mapped);
    } catch (e) { showError(e); }
  }, []);

  const reloadAudit = useCallback(async () => {
    try { setAudit((await apiGet('/audit')).map(mapAudit)); } catch { /* только owner */ }
  }, []);

  const reloadNotifications = useCallback(async () => {
    try { setNotifications((await apiGet('/notifications')).map(mapNotification)); } catch { /* ignore */ }
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      reloadCatalog(), reloadClients(), reloadAppointments(currentDate),
      reloadAudit(), reloadNotifications(),
    ]);
    setLoading(false);
  }, [reloadCatalog, reloadClients, reloadAppointments, reloadAudit, reloadNotifications, currentDate]);

  useEffect(() => {
    if (user) void reload();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) void reloadAppointments(currentDate);
  }, [currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // периодическое обновление записей и уведомлений (шахматка ~realtime)
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      void reloadAppointments(currentDate);
      void reloadNotifications();
    }, 15_000);
    return () => clearInterval(t);
  }, [user, currentDate, reloadAppointments, reloadNotifications]);

  /** Новый путь создания записи: клиент создаётся на сервере по телефону */
  const createBooking = useCallback(async (input: CreateBookingInput): Promise<boolean> => {
    try {
      const startAt = new Date(`${currentDate}T${input.time}:00`);
      await apiPost('/appointments', {
        boxId: input.boxId,
        serviceId: input.serviceId,
        startAt: startAt.toISOString(),
        employeeId: input.masterId || undefined,
        clientId: input.clientId || undefined,
        clientPhone: input.phone.replace(/[^\d+]/g, ''),
        clientName: input.clientName || undefined,
        carBrand: input.carBrand || undefined,
        carSize: input.carSize,
        comment: input.notes,
      });
      await Promise.all([reloadAppointments(currentDate), reloadClients()]);
      return true;
    } catch (e) {
      showError(e);
      return false;
    }
  }, [currentDate, reloadAppointments, reloadClients]);

  /** Совместимость со старым интерфейсом (используется как fallback) */
  const addAppointment = useCallback((apt: Appointment) => {
    const client = clientsList.find((c) => c.id === apt.clientId);
    void createBooking({
      phone: client?.phone ?? '',
      clientId: apt.clientId || undefined,
      serviceId: apt.serviceId,
      boxId: apt.boxId,
      time: apt.startAt,
      masterId: apt.masterId || undefined,
      notes: apt.notes,
    });
  }, [clientsList, createBooking]);

  const updateAppointmentStatus = useCallback(
    (id: string, status: AppointmentStatus, paymentMethod?: PaymentMethod, reason?: string) => {
      void (async () => {
        try {
          if (status === 'paid') {
            await apiPost(`/appointments/${id}/payment`, {
              paymentMethod: PAYMENT_MAP[paymentMethod ?? 'cash'],
            });
          } else if (status === 'cancelled') {
            await apiPost(`/appointments/${id}/cancel`, {
              cancelReason: reason || 'Отменено из панели',
            });
          } else {
            await apiPatch(`/appointments/${id}/status`, { status, cancelReason: reason });
          }
          await Promise.all([reloadAppointments(currentDate), reloadNotifications()]);
          if (status === 'paid') void reloadClients();
        } catch (e) { showError(e); }
      })();
    },
    [currentDate, reloadAppointments, reloadNotifications, reloadClients],
  );

  const deleteAppointment = useCallback((id: string) => {
    // физическое удаление запрещено ТЗ — переводим в отмену
    updateAppointmentStatus(id, 'cancelled', undefined, 'Удалено из интерфейса');
  }, [updateAppointmentStatus]);

  const addClient = useCallback((client: Client) => {
    void (async () => {
      try {
        await apiPost('/clients', {
          phone: client.phone.replace(/[^\d+]/g, ''),
          name: client.name,
          notes: client.notes || undefined,
          cars: client.carBrand
            ? [{ brand: client.carBrand, plateNumber: client.carNumber || undefined }]
            : undefined,
        });
        await reloadClients();
      } catch (e) { showError(e); }
    })();
  }, [reloadClients]);

  const updateClient = useCallback((id: string, updates: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    void apiPatch(`/clients/${id}`, {
      name: updates.name,
      notes: updates.notes,
    }).catch(showError);
  }, []);

  const addBox = useCallback((box: Box) => {
    void (async () => {
      try {
        await apiPost('/boxes', { name: box.name, color: box.color, sortOrder: box.orderIndex });
        await reloadCatalog();
      } catch (e) { showError(e); }
    })();
  }, [reloadCatalog]);

  const updateBox = useCallback((id: string, updates: Partial<Box>) => {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    void apiPatch(`/boxes/${id}`, {
      name: updates.name,
      color: updates.color,
      sortOrder: updates.orderIndex,
      ...(updates.isActive !== undefined ? { status: updates.isActive ? 'active' : 'inactive' } : {}),
    }).catch(showError);
  }, []);

  const deleteBox = useCallback((id: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    void apiDelete(`/boxes/${id}`).catch((e) => { showError(e); void reloadCatalog(); });
  }, [reloadCatalog]);

  const addService = useCallback((service: Service) => {
    void (async () => {
      try {
        await apiPost('/services', {
          name: service.name,
          durationMin: service.durationMin,
          price: service.price,
          priceBySize: service.priceBySize,
        });
        await reloadCatalog();
      } catch (e) { showError(e); }
    })();
  }, [reloadCatalog]);

  const updateService = useCallback((id: string, updates: Partial<Service>) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    void apiPatch(`/services/${id}`, {
      name: updates.name,
      durationMin: updates.durationMin,
      price: updates.price,
      priceBySize: updates.priceBySize,
    }).catch(showError);
  }, []);

  const deleteService = useCallback((id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
    void apiDelete(`/services/${id}`).catch((e) => { showError(e); void reloadCatalog(); });
  }, [reloadCatalog]);

  const addEmployee = useCallback((employee: Employee) => {
    void (async () => {
      try {
        const created = await apiPost('/employees', { name: employee.name, role: employee.role });
        // правило зарплаты по умолчанию (Business)
        if (employee.salaryValue > 0) {
          await apiPost('/salary/rules', {
            employeeId: created.id,
            type: employee.salaryType === 'fixed' ? 'fixed_month' : 'percent',
            config: employee.salaryType === 'fixed'
              ? { amount: employee.salaryValue }
              : { percent: employee.salaryValue },
          }).catch(() => { /* Light-план — без зарплат */ });
        }
        await reloadCatalog();
      } catch (e) { showError(e); }
    })();
  }, [reloadCatalog]);

  const updateEmployee = useCallback((id: string, updates: Partial<Employee>) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    if (updates.name !== undefined || updates.role !== undefined) {
      void apiPatch(`/employees/${id}`, {
        name: updates.name,
        role: updates.role,
      }).catch(showError);
    }
    // изменение зарплаты → пересоздаём правило (Business)
    if (updates.salaryValue !== undefined || updates.salaryType !== undefined) {
      void (async () => {
        try {
          const emp = await new Promise<Employee | undefined>((resolve) =>
            setEmployees((prev) => { resolve(prev.find((e) => e.id === id)); return prev; }),
          );
          if (!emp || !emp.salaryValue) return;
          const rules = await apiGet('/salary/rules');
          for (const r of rules.filter((r: any) => r.employeeId === id)) {
            await apiDelete(`/salary/rules/${r.id}`).catch(() => {});
          }
          await apiPost('/salary/rules', {
            employeeId: id,
            type: emp.salaryType === 'fixed' ? 'fixed_month' : 'percent',
            config: emp.salaryType === 'fixed'
              ? { amount: emp.salaryValue }
              : { percent: emp.salaryValue },
          });
        } catch { /* Light-план — без зарплат */ }
      })();
    }
  }, []);

  const deleteEmployee = useCallback((id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    void apiDelete(`/employees/${id}`).catch((e) => { showError(e); void reloadCatalog(); });
  }, [reloadCatalog]);

  // локальные записи аудита больше не нужны — сервер пишет сам
  const addAuditEntry = useCallback((_entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
    void reloadAudit();
  }, [reloadAudit]);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const now = new Date();
    const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setNotifications((prev) => [{ ...n, id: `local-${Date.now()}`, timestamp: ts, read: false }, ...prev]);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (!id.startsWith('local-')) void apiPost(`/notifications/${id}/read`).catch(() => {});
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    void apiPost('/notifications/read-all').catch(() => {});
  }, []);

  const value = useMemo(() => ({
    appointments, clients: clientsList, boxes: boxesList, services: servicesList,
    employees: employeesList, auditLog: audit, notifications,
    currentDate, setCurrentDate, loading,
    addAppointment, createBooking, updateAppointmentStatus, deleteAppointment,
    addClient, updateClient,
    addBox, updateBox, deleteBox,
    addService, updateService, deleteService,
    addEmployee, updateEmployee, deleteEmployee,
    addAuditEntry, addNotification,
    markNotificationRead, markAllNotificationsRead,
    reload,
  }), [
    appointments, clientsList, boxesList, servicesList, employeesList, audit, notifications,
    currentDate, loading,
    addAppointment, createBooking, updateAppointmentStatus, deleteAppointment,
    addClient, updateClient, addBox, updateBox, deleteBox,
    addService, updateService, deleteService,
    addEmployee, updateEmployee, deleteEmployee,
    addAuditEntry, addNotification, markNotificationRead, markAllNotificationsRead, reload,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
