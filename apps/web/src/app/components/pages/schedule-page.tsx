import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Phone, Car, Clock, User, MessageCircle, FileText, Banknote, QrCode, CreditCard, Send, Edit3, Trash2 } from 'lucide-react';
import { useStore } from '../../lib/store';
import {
  STATUS_COLORS, STATUS_LABELS, formatPrice,
  type Appointment, type AppointmentStatus, type CarSize, type PaymentMethod, type Client
} from '../../lib/mock-data';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

const TIME_SLOTS: string[] = [];
for (let h = 9; h <= 20; h++) {
  TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:00`);
  if (h < 20) TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:30`);
}

const SLOT_WIDTH = 120;
const BOX_ROW_HEIGHT = 84;

// Клиент для записи: сначала из общего списка store.clients, иначе — снимок,
// встроенный в саму запись из ответа API (свежие записи; роль «мастер» без доступа к /clients).
function resolveAppointmentClient(apt: Appointment, clients: Client[]): Client | undefined {
  return (
    clients.find((c) => c.id === apt.clientId) ??
    (apt.client
      ? { ...apt.client, totalVisits: 0, totalSpent: 0, lastVisitAt: '', notes: '' }
      : undefined)
  );
}

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function dateWithOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function formatDateLabel(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const label = `${d.getDate()} ${MONTHS_RU[d.getMonth()]}`;
  if (offset === 0) return `Сегодня, ${label}`;
  if (offset === 1) return `Завтра, ${label}`;
  if (offset === -1) return `Вчера, ${label}`;
  return label;
}

function getCardStyle(apt: Appointment) {
  const startMin = timeToMinutes(apt.startAt);
  const endMin = timeToMinutes(apt.endAt);
  const dayStart = 9 * 60;
  const left = ((startMin - dayStart) / 30) * SLOT_WIDTH;
  const width = ((endMin - startMin) / 30) * SLOT_WIDTH;
  return { left: `${left}px`, width: `${Math.max(width - 4, 40)}px` };
}

export function SchedulePage() {
  const store = useStore();
  const { appointments, boxes, services, clients, employees } = store;
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [bookingDefaults, setBookingDefaults] = useState<{ boxId?: string; time?: string }>({});
  const [viewMode, setViewMode] = useState<'day' | 'list'>('day');
  const [dateOffset, setDateOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentMinutes, setCurrentMinutes] = useState(nowMinutes());

  // Реальное время
  useEffect(() => {
    const interval = setInterval(() => setCurrentMinutes(nowMinutes()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Навигация по датам → загрузка записей выбранного дня из API
  useEffect(() => {
    store.setCurrentDate(dateWithOffset(dateOffset));
  }, [dateOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRef.current && viewMode === 'day') {
      const pos = ((currentMinutes - 9 * 60) / 30) * SLOT_WIDTH - 200;
      scrollRef.current.scrollLeft = Math.max(0, pos);
    }
  }, [viewMode]);

  const dateLabel = formatDateLabel(dateOffset);

  const handleSlotClick = (boxId: string, time: string) => {
    setBookingDefaults({ boxId, time });
    setShowBooking(true);
  };

  const getService = (id: string) => services.find(s => s.id === id);
  const getEmployee = (id: string) => employees.find(e => e.id === id);

  const sortedAppointments = [...appointments].sort((a, b) => a.startAt.localeCompare(b.startAt));

  // Sync selectedApt with store
  useEffect(() => {
    if (selectedApt) {
      const updated = appointments.find(a => a.id === selectedApt.id);
      if (updated) setSelectedApt(updated);
    }
  }, [appointments]);

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 lg:px-6 py-3 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-[#111827] hidden lg:block shrink-0" style={{ fontSize: '20px', fontWeight: 700 }}>Шахматка</h1>
          <div className="flex items-center gap-1 lg:ml-4 bg-[#F3F4F6] rounded-lg p-0.5">
            <button className="p-1.5 rounded-md hover:bg-white" onClick={() => setDateOffset(d => d - 1)}>
              <ChevronLeft className="w-4 h-4 text-[#6B7280]" />
            </button>
            <span className="px-2 lg:px-3 text-[#111827] whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 600 }}>{dateLabel}</span>
            <button className="p-1.5 rounded-md hover:bg-white" onClick={() => setDateOffset(d => d + 1)}>
              <ChevronRight className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>
          {dateOffset !== 0 && (
            <button onClick={() => setDateOffset(0)} className="px-2.5 py-1.5 rounded-md text-[#1B4F8A] bg-[#EBF0F9] shrink-0" style={{ fontSize: '12px', fontWeight: 500 }}>Сегодня</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Status summary */}
          <div className="hidden lg:flex items-center gap-3 mr-4">
            {(['in_progress', 'confirmed', 'pending'] as AppointmentStatus[]).map(s => {
              const count = appointments.filter(a => a.status === s).length;
              return count > 0 ? (
                <div key={s} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                  <span className="text-[#6B7280]" style={{ fontSize: '12px' }}>{count} {STATUS_LABELS[s].toLowerCase()}</span>
                </div>
              ) : null;
            })}
          </div>
          <div className="flex items-center gap-1 bg-[#F3F4F6] rounded-lg p-0.5">
            {(['day', 'list'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-md transition-colors ${viewMode === m ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}
                style={{ fontSize: '12px', fontWeight: 500 }}>
                {m === 'day' ? 'Сетка' : 'Список'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === 'day' ? (
        /* GRID VIEW */
        <div className="flex-1 overflow-hidden flex">
          <div className="w-[90px] lg:w-[120px] shrink-0 bg-white border-r border-[#E5E7EB]">
            <div className="h-[40px] border-b border-[#E5E7EB]" />
            {boxes.map(box => (
              <div key={box.id} className="flex items-center px-3 border-b border-[#F3F4F6]" style={{ height: `${BOX_ROW_HEIGHT}px` }}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: box.color }} />
                  <span className="text-[#111827] truncate" style={{ fontSize: '12px', fontWeight: 500 }}>{box.name}</span>
                </div>
              </div>
            ))}
          </div>
          <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto">
            <div style={{ width: `${TIME_SLOTS.length * SLOT_WIDTH}px`, minHeight: '100%' }}>
              <div className="flex h-[40px] border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
                {TIME_SLOTS.map(t => (
                  <div key={t} className="shrink-0 flex items-center justify-center border-r border-[#F3F4F6] text-[#6B7280]"
                    style={{ width: `${SLOT_WIDTH}px`, fontSize: '12px', fontWeight: 500 }}>{t}</div>
                ))}
              </div>
              <div className="relative">
                {dateOffset === 0 && (
                  <div className="absolute top-0 bottom-0 w-[2px] bg-[#DC2626] z-20" style={{ left: `${((currentMinutes - 9 * 60) / 30) * SLOT_WIDTH}px` }}>
                    <div className="absolute -top-1.5 -left-[5px] w-3 h-3 rounded-full bg-[#DC2626]" />
                    <div className="absolute -top-5 -left-4 bg-[#DC2626] text-white px-1.5 py-0.5 rounded"
                      style={{ fontSize: '10px', fontWeight: 600 }}>
                      {`${Math.floor(currentMinutes / 60)}:${(currentMinutes % 60).toString().padStart(2, '0')}`}
                    </div>
                  </div>
                )}
                {boxes.map(box => {
                  const boxApts = appointments.filter(a => a.boxId === box.id);
                  return (
                    <div key={box.id} className="relative border-b border-[#F3F4F6]" style={{ height: `${BOX_ROW_HEIGHT}px` }}>
                      {TIME_SLOTS.map(t => (
                        <div key={t} className="absolute top-0 bottom-0 border-r border-[#F3F4F6] cursor-pointer hover:bg-[#FAFBFF] transition-colors"
                          style={{ left: `${TIME_SLOTS.indexOf(t) * SLOT_WIDTH}px`, width: `${SLOT_WIDTH}px` }}
                          onClick={() => handleSlotClick(box.id, t)} />
                      ))}
                      {boxApts.map(apt => {
                        const style = getCardStyle(apt);
                        const client = resolveAppointmentClient(apt, clients);
                        const service = getService(apt.serviceId);
                        const bgColor = STATUS_COLORS[apt.status];
                        const isCancelled = apt.status === 'cancelled' || apt.status === 'no_show';
                        return (
                          <div key={apt.id}
                            className={`absolute top-[6px] rounded-lg cursor-pointer transition-all hover:shadow-lg hover:z-10 overflow-hidden ${isCancelled ? 'opacity-50' : ''}`}
                            style={{ ...style, height: `${BOX_ROW_HEIGHT - 12}px`, backgroundColor: `${bgColor}15`, borderLeft: `3px solid ${bgColor}` }}
                            onClick={(e) => { e.stopPropagation(); setSelectedApt(apt); }}>
                            <div className="px-2 py-1.5 h-full flex flex-col justify-between">
                              <div className="min-w-0">
                                <p className={`text-[#111827] truncate ${isCancelled ? 'line-through' : ''}`} style={{ fontSize: '12px', fontWeight: 600 }}>{client?.name || 'Клиент'}</p>
                                <p className="text-[#6B7280] truncate" style={{ fontSize: '10px' }}>{client?.carBrand} · {service?.name}</p>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[#9CA3AF]" style={{ fontSize: '10px' }}>{apt.startAt}–{apt.endAt}</span>
                                <span className="px-1.5 py-0.5 rounded text-white" style={{ fontSize: '9px', fontWeight: 600, backgroundColor: bgColor }}>
                                  {formatPrice(apt.price)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-[700px] mx-auto space-y-2">
            {sortedAppointments.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-12 h-12 text-[#E5E7EB] mx-auto mb-3" />
                <p className="text-[#6B7280]" style={{ fontSize: '16px', fontWeight: 500 }}>Нет записей на этот день</p>
                <button onClick={() => setShowBooking(true)} className="mt-3 px-4 py-2 rounded-lg bg-[#2D6BE4] text-white" style={{ fontSize: '13px', fontWeight: 500 }}>Создать запись</button>
              </div>
            ) : sortedAppointments.map(apt => {
              const client = resolveAppointmentClient(apt, clients);
              const service = getService(apt.serviceId);
              const box = boxes.find(b => b.id === apt.boxId);
              const master = getEmployee(apt.masterId);
              const bgColor = STATUS_COLORS[apt.status];
              return (
                <div key={apt.id} onClick={() => setSelectedApt(apt)}
                  className="bg-white rounded-xl border border-[#E5E7EB] p-4 cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-center shrink-0" style={{ width: '48px' }}>
                        <p className="text-[#111827]" style={{ fontSize: '16px', fontWeight: 700 }}>{apt.startAt}</p>
                        <p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>{apt.endAt}</p>
                      </div>
                      <div className="w-[3px] h-10 rounded-full" style={{ backgroundColor: bgColor }} />
                      <div>
                        <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 600 }}>{client?.name || 'Клиент'}</p>
                        <p className="text-[#6B7280]" style={{ fontSize: '12px' }}>{service?.name} · {client?.carBrand}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>{box?.name}</span>
                          {master && <span className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>· {master.name}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-white" style={{ fontSize: '10px', fontWeight: 600, backgroundColor: bgColor }}>{STATUS_LABELS[apt.status]}</span>
                      <p className="text-[#111827] mt-1" style={{ fontSize: '14px', fontWeight: 600 }}>{formatPrice(apt.price)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => { setBookingDefaults({}); setShowBooking(true); }}
        className="fixed bottom-[90px] lg:bottom-6 right-4 lg:right-6 w-14 h-14 rounded-full bg-[#2D6BE4] text-white shadow-lg flex items-center justify-center hover:bg-[#1B4F8A] transition-colors z-30 active:scale-95">
        <Plus className="w-6 h-6" />
      </button>

      {/* Modals */}
      <AnimatePresence>
        {selectedApt && !showPayment && !showCancel && (
          <AppointmentDetail apt={selectedApt} store={store}
            onClose={() => setSelectedApt(null)}
            onPayment={() => setShowPayment(true)}
            onCancel={() => setShowCancel(true)} />
        )}
      </AnimatePresence>

      {showBooking && (
        <BookingModal defaults={bookingDefaults} store={store} onClose={() => setShowBooking(false)} />
      )}

      {showPayment && selectedApt && (
        <PaymentModal apt={selectedApt} store={store} onClose={() => { setShowPayment(false); setSelectedApt(null); }} />
      )}

      {showCancel && selectedApt && (
        <CancelModal apt={selectedApt} store={store} onClose={() => { setShowCancel(false); setSelectedApt(null); }} />
      )}
    </div>
  );
}

function AppointmentDetail({ apt, store, onClose, onPayment, onCancel }: {
  apt: Appointment; store: ReturnType<typeof useStore>; onClose: () => void; onPayment: () => void; onCancel: () => void;
}) {
  const client = resolveAppointmentClient(apt, store.clients);
  const service = store.services.find(s => s.id === apt.serviceId);
  const employee = store.employees.find(e => e.id === apt.masterId);
  const box = store.boxes.find(b => b.id === apt.boxId);
  const bgColor = STATUS_COLORS[apt.status];

  const statuses: AppointmentStatus[] = ['pending', 'confirmed', 'in_progress', 'done', 'paid'];
  const currentIdx = statuses.indexOf(apt.status);

  const sourceLabels: Record<string, string> = { admin_panel: 'Админ-панель', online_widget: 'Онлайн-виджет', phone: 'Звонок' };

  const handleStatusChange = (newStatus: AppointmentStatus) => {
    store.updateAppointmentStatus(apt.id, newStatus);
    toast.success(`Статус: ${STATUS_LABELS[newStatus]}`);
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div className="relative w-full lg:w-[460px] bg-white h-full overflow-y-auto shadow-xl"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}>
        <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full text-white" style={{ fontSize: '12px', fontWeight: 600, backgroundColor: bgColor }}>{STATUS_LABELS[apt.status]}</span>
            <span className="text-[#6B7280]" style={{ fontSize: '13px' }}>{box?.name}</span>
            <span className="text-[#9CA3AF]" style={{ fontSize: '12px' }}>#{apt.id}</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F3F4F6]"><X className="w-5 h-5 text-[#6B7280]" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <p className="text-[#111827]" style={{ fontSize: '18px', fontWeight: 600 }}>{service?.name}</p>
            <p className="text-[#111827] mt-1" style={{ fontSize: '30px', fontWeight: 700 }}>{formatPrice(apt.price)}</p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1 text-[#6B7280]">
                <Clock className="w-3.5 h-3.5" />
                <span style={{ fontSize: '13px' }}>{apt.startAt} – {apt.endAt} · {service?.durationMin} мин</span>
              </div>
            </div>
          </div>

          {/* Client Card */}
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#EBF0F9] flex items-center justify-center">
                  <span className="text-[#1B4F8A]" style={{ fontSize: '14px', fontWeight: 600 }}>{client?.name?.[0]}</span>
                </div>
                <div>
                  <p className="text-[#111827]" style={{ fontSize: '15px', fontWeight: 600 }}>{client?.name || 'Без имени'}</p>
                  {(client?.carBrand || client?.carNumber) && (
                    <p className="text-[#6B7280]" style={{ fontSize: '12px' }}>{[client?.carBrand, client?.carNumber].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
              </div>
              <a href={`tel:${client?.phone}`} className="p-2 rounded-lg bg-[#EBF0F9]">
                <Phone className="w-4 h-4 text-[#1B4F8A]" />
              </a>
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t border-[#E5E7EB]">
              <div>
                <p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>Визиты</p>
                <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 600 }}>{client?.totalVisits}</p>
              </div>
              <div>
                <p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>Потрачено</p>
                <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 600 }}>{formatPrice(client?.totalSpent || 0)}</p>
              </div>
              <div>
                <p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>Источник</p>
                <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{sourceLabels[apt.source]}</p>
              </div>
            </div>
          </div>

          {/* Status Timeline */}
          <div>
            <p className="text-[#6B7280] uppercase mb-3" style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.05em' }}>Прогресс</p>
            <div className="flex items-center gap-1">
              {statuses.map((s, i) => {
                const isActive = i <= currentIdx && apt.status !== 'cancelled' && apt.status !== 'no_show';
                return <div key={s} className="flex-1"><div className={`h-2 rounded-full ${isActive ? '' : 'bg-[#E5E7EB]'}`} style={isActive ? { backgroundColor: STATUS_COLORS[s] } : {}} /></div>;
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              {statuses.map(s => (
                <span key={s} className="text-[#9CA3AF] text-center flex-1" style={{ fontSize: '9px' }}>{STATUS_LABELS[s]}</span>
              ))}
            </div>
          </div>

          {/* Master & Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2 text-[#6B7280]"><User className="w-4 h-4" /><span style={{ fontSize: '13px' }}>Мастер</span></div>
              <span className="text-[#111827]" style={{ fontSize: '13px', fontWeight: 500 }}>{employee?.name || '—'}</span>
            </div>
            {apt.paymentMethod && (
              <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6]">
                <div className="flex items-center gap-2 text-[#6B7280]"><CreditCard className="w-4 h-4" /><span style={{ fontSize: '13px' }}>Оплата</span></div>
                <span className="text-[#111827]" style={{ fontSize: '13px', fontWeight: 500 }}>
                  {{ cash: 'Наличные', kaspi_qr: 'Kaspi QR', kaspi_transfer: 'Kaspi перевод', card: 'Карта' }[apt.paymentMethod]}
                </span>
              </div>
            )}
            {apt.notes && (
              <div className="bg-[#FFFBEB] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3.5 h-3.5 text-[#D97706]" />
                  <span className="text-[#D97706]" style={{ fontSize: '11px', fontWeight: 500 }}>Заметка</span>
                </div>
                <p className="text-[#111827]" style={{ fontSize: '13px' }}>{apt.notes}</p>
              </div>
            )}
          </div>

          {/* Audit Mini-log */}
          <div>
            <p className="text-[#6B7280] uppercase mb-2" style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.05em' }}>История изменений</p>
            <div className="space-y-2 relative pl-4 before:absolute before:left-[5px] before:top-0 before:bottom-0 before:w-[1px] before:bg-[#E5E7EB]">
              {store.auditLog.filter(e => e.entity.includes(apt.id)).slice(0, 5).map(entry => (
                <div key={entry.id} className="flex items-start gap-2 relative">
                  <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#E5E7EB]" />
                  <div>
                    <p className="text-[#111827]" style={{ fontSize: '12px', fontWeight: 500 }}>{entry.action}</p>
                    <p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>{entry.timestamp} · {entry.user}</p>
                  </div>
                </div>
              ))}
              {store.auditLog.filter(e => e.entity.includes(apt.id)).length === 0 && (
                <p className="text-[#9CA3AF]" style={{ fontSize: '12px' }}>Нет записей</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#E5E7EB] space-y-2.5">
            {apt.status === 'pending' && (
              <button onClick={() => handleStatusChange('confirmed')} className="w-full py-3 rounded-lg bg-[#3B82F6] text-white" style={{ fontSize: '14px', fontWeight: 600 }}>
                Подтвердить запись
              </button>
            )}
            {apt.status === 'confirmed' && (
              <button onClick={() => handleStatusChange('in_progress')} className="w-full py-3 rounded-lg bg-[#F59E0B] text-white" style={{ fontSize: '14px', fontWeight: 600 }}>
                Клиент приехал → В работу
              </button>
            )}
            {apt.status === 'in_progress' && (
              <button onClick={() => handleStatusChange('done')} className="w-full py-3 rounded-lg bg-[#10B981] text-white" style={{ fontSize: '14px', fontWeight: 600 }}>
                Работа завершена ✓
              </button>
            )}
            {apt.status === 'done' && (
              <button onClick={onPayment} className="w-full py-3.5 rounded-lg bg-[#2D6BE4] text-white" style={{ fontSize: '14px', fontWeight: 600 }}>
                Принять оплату — {formatPrice(apt.price)}
              </button>
            )}
            {!['paid', 'cancelled', 'no_show'].includes(apt.status) && (
              <button onClick={onCancel} className="w-full py-3 rounded-lg border border-[#DC2626] text-[#DC2626]" style={{ fontSize: '14px', fontWeight: 500 }}>
                Отменить запись
              </button>
            )}
            {apt.status === 'paid' && (
              <div className="text-center py-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ECFDF5]">
                  <div className="w-5 h-5 rounded-full bg-[#059669] flex items-center justify-center">
                    <span className="text-white" style={{ fontSize: '10px' }}>✓</span>
                  </div>
                  <span className="text-[#059669]" style={{ fontSize: '14px', fontWeight: 600 }}>Оплачено</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function BookingModal({ defaults, store, onClose }: { defaults: { boxId?: string; time?: string }; store: ReturnType<typeof useStore>; onClose: () => void }) {
  const { clients, services, boxes, employees, addAppointment, addClient } = store;
  const [phone, setPhone] = useState('');
  const [foundClient, setFoundClient] = useState<typeof clients[0] | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCar, setNewCar] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedBox, setSelectedBox] = useState(defaults.boxId || '');
  const [selectedTime, setSelectedTime] = useState(defaults.time || '');
  const [selectedMaster, setSelectedMaster] = useState('');
  const [carSize, setCarSize] = useState<CarSize>('M');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    if (val.length >= 3) {
      const found = clients.find(c => c.phone.includes(val));
      setFoundClient(found || null);
      setIsNewClient(!found);
    } else {
      setFoundClient(null);
      setIsNewClient(false);
    }
  };

  const svc = services.find(s => s.id === selectedService);
  const price = svc ? svc.priceBySize[carSize] : 0;

  const handleSubmit = async () => {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if ((!foundClient && (!cleanPhone || !newName)) || !selectedService || !selectedBox || !selectedTime) {
      toast.error('Заполните все обязательные поля');
      return;
    }
    const ok = await store.createBooking({
      phone: foundClient?.phone.replace(/[^\d+]/g, '') ?? (cleanPhone.startsWith('+') ? cleanPhone : `+7${cleanPhone.replace(/^[78]/, '')}`),
      clientId: foundClient?.id,
      clientName: isNewClient ? newName : undefined,
      carBrand: isNewClient ? (newCar || undefined) : undefined,
      carSize,
      serviceId: selectedService,
      boxId: selectedBox,
      time: selectedTime,
      masterId: selectedMaster || employees.find(e => e.role === 'master')?.id || undefined,
      notes: notes || undefined,
    });
    if (ok) {
      toast.success('Запись создана!');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div className="relative w-full lg:w-[500px] max-h-[92vh] bg-white rounded-t-2xl lg:rounded-2xl overflow-y-auto"
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 25 }}>
        <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-5 py-4 flex items-center justify-between z-10">
          <h3 className="text-[#111827]" style={{ fontSize: '18px', fontWeight: 600 }}>Новая запись</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F3F4F6]"><X className="w-5 h-5 text-[#6B7280]" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Phone */}
          <div>
            <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Телефон клиента</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input type="tel" placeholder="+7 (___) ___-__-__" value={phone} onChange={e => handlePhoneChange(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:border-[#2D6BE4] focus:outline-none" style={{ fontSize: '16px' }} />
            </div>
          </div>

          {foundClient && (
            <motion.div className="bg-[#ECFDF5] rounded-xl p-3 flex items-center gap-3" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
              <div className="w-10 h-10 rounded-full bg-[#059669] flex items-center justify-center shrink-0">
                <span className="text-white" style={{ fontSize: '14px', fontWeight: 600 }}>{foundClient.name[0]}</span>
              </div>
              <div>
                <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 600 }}>{foundClient.name} · {foundClient.carBrand}</p>
                <p className="text-[#059669]" style={{ fontSize: '12px' }}>{foundClient.totalVisits} визитов · {formatPrice(foundClient.totalSpent)}</p>
              </div>
            </motion.div>
          )}

          {isNewClient && phone.length >= 3 && (
            <motion.div className="space-y-3 bg-[#F0F6FF] rounded-xl p-4" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-[#2D6BE4] text-white" style={{ fontSize: '11px', fontWeight: 600 }}>Новый клиент</span>
              </div>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Имя клиента"
                className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
              <input value={newCar} onChange={e => setNewCar(e.target.value)} placeholder="Марка авто (напр. Toyota Camry)"
                className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
            </motion.div>
          )}

          {/* Service */}
          <div>
            <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Услуга *</label>
            <select value={selectedService} onChange={e => setSelectedService(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:border-[#2D6BE4] focus:outline-none" style={{ fontSize: '14px' }}>
              <option value="">Выберите услугу</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} · {s.durationMin} мин · {formatPrice(s.priceBySize[carSize])}</option>)}
            </select>
          </div>

          {/* Car Size */}
          <div>
            <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Размер авто</label>
            <div className="flex gap-2">
              {(['S', 'M', 'L', 'XL'] as CarSize[]).map(size => (
                <button key={size} onClick={() => setCarSize(size)}
                  className={`flex-1 py-2.5 rounded-lg border transition-all ${carSize === size ? 'bg-[#2D6BE4] text-white border-[#2D6BE4] shadow-sm' : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#2D6BE4]'}`}
                  style={{ fontSize: '13px', fontWeight: 600 }}>
                  {size}
                  {svc && <span className="block text-[10px] mt-0.5 opacity-80">{formatPrice(svc.priceBySize[size])}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Box & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Бокс *</label>
              <select value={selectedBox} onChange={e => setSelectedBox(e.target.value)}
                className="w-full px-3 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }}>
                <option value="">Выберите</option>
                {boxes.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Время *</label>
              <select value={selectedTime} onChange={e => setSelectedTime(e.target.value)}
                className="w-full px-3 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }}>
                <option value="">Выберите</option>
                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Master */}
          <div>
            <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Мастер</label>
            <select value={selectedMaster} onChange={e => setSelectedMaster(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }}>
              <option value="">Авто-назначение</option>
              {employees.filter(e => e.role === 'master').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {/* Notes toggle */}
          {!showNotes ? (
            <button onClick={() => setShowNotes(true)} className="flex items-center gap-2 text-[#6B7280]" style={{ fontSize: '13px' }}>
              <Edit3 className="w-3.5 h-3.5" /> Добавить заметку
            </button>
          ) : (
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Комментарий к записи..."
              className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none resize-none" style={{ fontSize: '14px' }} />
          )}

          {/* Total */}
          {svc && (
            <div className="bg-[#F9FAFB] rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-[#6B7280]" style={{ fontSize: '12px' }}>Итого</p>
                <p className="text-[#6B7280]" style={{ fontSize: '11px' }}>{svc.name} · {svc.durationMin} мин</p>
              </div>
              <span className="text-[#111827]" style={{ fontSize: '26px', fontWeight: 700 }}>{formatPrice(price)}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-[#E5E7EB] text-[#6B7280]" style={{ fontSize: '14px', fontWeight: 500 }}>Отмена</button>
            <button onClick={handleSubmit} className="flex-1 py-3 rounded-lg bg-[#2D6BE4] text-white active:scale-[0.98] transition-transform" style={{ fontSize: '14px', fontWeight: 600 }}>Записать</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PaymentModal({ apt, store, onClose }: { apt: Appointment; store: ReturnType<typeof useStore>; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [receiptCode, setReceiptCode] = useState('');
  const service = store.services.find(s => s.id === apt.serviceId);

  const methods: { id: PaymentMethod; label: string; Icon: typeof Banknote }[] = [
    { id: 'cash', label: 'Наличные', Icon: Banknote },
    { id: 'kaspi_qr', label: 'Kaspi QR', Icon: QrCode },
    { id: 'kaspi_transfer', label: 'Kaspi перевод', Icon: Send },
    { id: 'card', label: 'Карта', Icon: CreditCard },
  ];

  const handleConfirm = () => {
    if (!method) return;
    store.updateAppointmentStatus(apt.id, 'paid', method);
    toast.success('Оплата подтверждена!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div className="relative w-full lg:w-[420px] bg-white rounded-t-2xl lg:rounded-2xl overflow-hidden"
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-[#111827]" style={{ fontSize: '18px', fontWeight: 600 }}>Принять оплату</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F3F4F6]"><X className="w-5 h-5 text-[#6B7280]" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="text-center">
            <p className="text-[#6B7280]" style={{ fontSize: '14px' }}>{service?.name}</p>
            <p className="text-[#111827] mt-1" style={{ fontSize: '38px', fontWeight: 700 }}>{formatPrice(apt.price)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {methods.map(m => (
              <button key={m.id} onClick={() => setMethod(m.id)}
                className={`py-4 rounded-xl border-2 transition-all ${method === m.id ? 'border-[#2D6BE4] bg-[#EBF0F9] shadow-sm' : 'border-[#E5E7EB] hover:border-[#2D6BE4]'}`}>
                <m.Icon className={`w-6 h-6 mx-auto ${method === m.id ? 'text-[#2D6BE4]' : 'text-[#6B7280]'}`} />
                <span className="block text-center text-[#111827] mt-1.5" style={{ fontSize: '13px', fontWeight: 500 }}>{m.label}</span>
              </button>
            ))}
          </div>

          {method === 'kaspi_qr' && (
            <div className="bg-[#F9FAFB] rounded-xl p-6 text-center">
              <div className="w-36 h-36 mx-auto bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-center mb-3">
                <div className="grid grid-cols-7 grid-rows-7 gap-px w-28 h-28">
                  {Array.from({ length: 49 }).map((_, i) => (
                    <div key={i} className={`${[0,1,2,4,5,6,7,8,13,14,21,28,35,36,42,43,44,46,47,48].includes(i) ? 'bg-[#0D1F3C]' : (Math.random() > 0.4 ? 'bg-[#0D1F3C]' : 'bg-transparent')}`} />
                  ))}
                </div>
              </div>
              <p className="text-[#6B7280]" style={{ fontSize: '13px' }}>Клиент сканирует QR-код</p>
            </div>
          )}

          {method === 'cash' && (
            <div>
              <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Последние 4 цифры (необязательно)</label>
              <input type="text" maxLength={4} value={receiptCode} onChange={e => setReceiptCode(e.target.value.replace(/\D/g, ''))} placeholder="0000"
                className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-center text-[#111827] focus:outline-none" style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '0.3em' }} />
            </div>
          )}

          <button onClick={handleConfirm} disabled={!method}
            className={`w-full py-3.5 rounded-lg text-white transition-all ${method ? 'bg-[#059669] active:scale-[0.98]' : 'bg-[#9CA3AF] cursor-not-allowed'}`}
            style={{ fontSize: '14px', fontWeight: 600 }}>
            Подтвердить оплату
          </button>
          <p className="text-center text-[#9CA3AF]" style={{ fontSize: '12px' }}>Зарплата мастеру будет начислена автоматически</p>
        </div>
      </motion.div>
    </div>
  );
}

function CancelModal({ apt, store, onClose }: { apt: Appointment; store: ReturnType<typeof useStore>; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [cancelType, setCancelType] = useState<'cancelled' | 'no_show'>('cancelled');

  const handleConfirm = () => {
    store.updateAppointmentStatus(apt.id, cancelType, undefined, reason || undefined);
    toast.error(cancelType === 'no_show' ? 'Неявка зафиксирована' : 'Запись отменена');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div className="relative w-[90%] lg:w-[420px] bg-white rounded-2xl overflow-hidden"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <div className="px-5 py-4 border-b border-[#E5E7EB]">
          <h3 className="text-[#DC2626]" style={{ fontSize: '18px', fontWeight: 600 }}>Отменить запись</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setCancelType('cancelled')}
              className={`flex-1 py-2.5 rounded-lg border-2 ${cancelType === 'cancelled' ? 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]' : 'border-[#E5E7EB] text-[#6B7280]'}`}
              style={{ fontSize: '13px', fontWeight: 500 }}>Отмена</button>
            <button onClick={() => setCancelType('no_show')}
              className={`flex-1 py-2.5 rounded-lg border-2 ${cancelType === 'no_show' ? 'border-[#F97316] bg-[#FFF7ED] text-[#F97316]' : 'border-[#E5E7EB] text-[#6B7280]'}`}
              style={{ fontSize: '13px', fontWeight: 500 }}>Неявка</button>
          </div>
          <div>
            <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Причина *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Укажите причину отмены..."
              className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none resize-none" style={{ fontSize: '14px' }} />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-[#E5E7EB] text-[#6B7280]" style={{ fontSize: '14px', fontWeight: 500 }}>Назад</button>
            <button onClick={handleConfirm} disabled={!reason}
              className={`flex-1 py-3 rounded-lg text-white ${reason ? 'bg-[#DC2626]' : 'bg-[#9CA3AF] cursor-not-allowed'}`}
              style={{ fontSize: '14px', fontWeight: 600 }}>Подтвердить</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
