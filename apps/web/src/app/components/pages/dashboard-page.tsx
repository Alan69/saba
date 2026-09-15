import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown, Users, Clock, AlertTriangle, DollarSign, ArrowRight, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useStore } from '../../lib/store';
import { useAuth } from '../../lib/auth';
import { apiGet } from '../../lib/api';
import { formatPrice, STATUS_LABELS, STATUS_COLORS, type AppointmentStatus } from '../../lib/mock-data';

const WEEKDAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/** Последние 7 дней из /dashboard/analytics → данные графика */
function buildWeekSeries(revenueByDay: Record<string, number>): { day: string; revenue: number }[] {
  const out: { day: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    out.push({ day: WEEKDAYS_RU[d.getDay()], revenue: revenueByDay[iso] ?? 0 });
  }
  return out;
}

const PAYMENT_COLORS: Record<string, string> = { cash: '#6B7280', kaspi_qr: '#F59E0B', kaspi_transfer: '#3B82F6', card: '#8B5CF6' };
const PAYMENT_LABELS: Record<string, string> = { cash: 'Наличные', kaspi_qr: 'Kaspi QR', kaspi_transfer: 'Kaspi перевод', card: 'Карта' };

export function DashboardPage() {
  const { appointments, boxes, services, employees, clients } = useStore();
  const { company } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [serverToday, setServerToday] = useState<{ revenueTrend: number | null } | null>(null);
  const [weekRevenue, setWeekRevenue] = useState<{ day: string; revenue: number }[] | null>(null);

  useEffect(() => {
    apiGet('/dashboard/today').then(setServerToday).catch(() => {});
    apiGet('/dashboard/analytics?period=week')
      .then((d) => setWeekRevenue(buildWeekSeries(d.revenueByDay)))
      .catch(() => setWeekRevenue(null)); // Light-план — без недельной аналитики
  }, [appointments.length]);

  const dateLabel = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
  }).format(new Date());

  const stats = useMemo(() => {
    const paid = appointments.filter(a => a.status === 'paid');
    const today = appointments;
    const revenue = paid.reduce((s, a) => s + a.price, 0);
    const cash = paid.filter(a => a.paymentMethod === 'cash').reduce((s, a) => s + a.price, 0);
    const kaspi = paid.filter(a => a.paymentMethod === 'kaspi_qr' || a.paymentMethod === 'kaspi_transfer').reduce((s, a) => s + a.price, 0);
    const card = paid.filter(a => a.paymentMethod === 'card').reduce((s, a) => s + a.price, 0);
    const noShows = today.filter(a => a.status === 'no_show');
    const cancelled = today.filter(a => a.status === 'cancelled');
    const inProgress = today.filter(a => a.status === 'in_progress');
    const confirmed = today.filter(a => a.status === 'confirmed');
    const pending = today.filter(a => a.status === 'pending');

    const paymentBreakdown = [
      { name: 'Наличные', value: cash, color: '#6B7280' },
      { name: 'Kaspi QR', value: paid.filter(a => a.paymentMethod === 'kaspi_qr').reduce((s, a) => s + a.price, 0), color: '#F59E0B' },
      { name: 'Kaspi перевод', value: paid.filter(a => a.paymentMethod === 'kaspi_transfer').reduce((s, a) => s + a.price, 0), color: '#3B82F6' },
      { name: 'Карта', value: card, color: '#8B5CF6' },
    ].filter(p => p.value > 0);

    const boxUtil = boxes.map(box => {
      const boxApts = today.filter(a => a.boxId === box.id && a.status !== 'cancelled' && a.status !== 'no_show');
      const totalMin = boxApts.reduce((s, a) => {
        const [sh, sm] = a.startAt.split(':').map(Number);
        const [eh, em] = a.endAt.split(':').map(Number);
        return s + (eh * 60 + em) - (sh * 60 + sm);
      }, 0);
      const workday = 11 * 60; // 09:00–20:00
      return { name: box.name, color: box.color, pct: Math.min(100, Math.round((totalMin / workday) * 100)) };
    });

    const svcRevenue = services.map(svc => ({
      name: svc.name,
      revenue: paid.filter(a => a.serviceId === svc.id).reduce((s, a) => s + a.price, 0),
      count: paid.filter(a => a.serviceId === svc.id).length,
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const masterStats = employees.filter(e => e.role === 'master').map(emp => {
      const empApts = paid.filter(a => a.masterId === emp.id);
      return { name: emp.name, revenue: empApts.reduce((s, a) => s + a.price, 0), count: empApts.length };
    }).sort((a, b) => b.revenue - a.revenue);

    const statusCounts: Record<string, number> = {};
    today.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });

    return {
      revenue, cash, kaspi: kaspi, card, paymentBreakdown,
      totalAppointments: today.length, noShows: noShows.length,
      noShowLoss: noShows.reduce((s, a) => s + a.price, 0),
      cancelledCount: cancelled.length,
      cancelledLoss: cancelled.reduce((s, a) => s + a.price, 0),
      inProgressCount: inProgress.length,
      confirmedCount: confirmed.length,
      pendingCount: pending.length,
      paidCount: paid.length,
      boxUtil, svcRevenue, masterStats, statusCounts,
    };
  }, [appointments, boxes, services, employees]);

  return (
    <div className="p-4 lg:p-8 max-w-[1200px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#111827]" style={{ fontSize: '24px', fontWeight: 700 }}>Дашборд</h1>
          <p className="text-[#6B7280] mt-0.5" style={{ fontSize: '14px' }}>{company?.name ?? ''} · {dateLabel}</p>
        </div>
        <div className="flex items-center gap-1 bg-[#F3F4F6] rounded-lg p-0.5">
          {([['today', 'Сегодня'], ['week', 'Неделя'], ['month', 'Месяц']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)}
              className={`px-3 py-1.5 rounded-md transition-colors ${period === k ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}
              style={{ fontSize: '13px', fontWeight: 500 }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Revenue Hero */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 lg:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[#6B7280] uppercase tracking-wider" style={{ fontSize: '11px', fontWeight: 500 }}>Выручка сегодня</p>
            <p className="text-[#111827] mt-1" style={{ fontSize: '40px', fontWeight: 700, lineHeight: 1.1 }}>{formatPrice(stats.revenue)}</p>
            {serverToday?.revenueTrend != null && (
              <div className="flex items-center gap-1 mt-2">
                <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full ${serverToday.revenueTrend >= 0 ? 'bg-[#ECFDF5]' : 'bg-[#FEF2F2]'}`}>
                  {serverToday.revenueTrend >= 0
                    ? <TrendingUp className="w-3.5 h-3.5 text-[#059669]" />
                    : <TrendingDown className="w-3.5 h-3.5 text-[#DC2626]" />}
                  <span className={serverToday.revenueTrend >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'} style={{ fontSize: '13px', fontWeight: 600 }}>
                    {serverToday.revenueTrend >= 0 ? '+' : ''}{serverToday.revenueTrend}%
                  </span>
                </div>
                <span className="text-[#6B7280]" style={{ fontSize: '13px' }}>к вчера</span>
              </div>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#EBF0F9] flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-[#1B4F8A]" />
          </div>
        </div>
        {/* Payment breakdown */}
        <div className="flex flex-wrap gap-4 lg:gap-6 mt-4 pt-4 border-t border-[#E5E7EB]">
          {stats.paymentBreakdown.map(p => (
            <div key={p.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <div>
                <p className="text-[#6B7280]" style={{ fontSize: '11px' }}>{p.name}</p>
                <p className="text-[#111827]" style={{ fontSize: '16px', fontWeight: 600 }}>{formatPrice(p.value)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {([
          { label: 'Всего записей', value: stats.totalAppointments, color: '#1B4F8A', icon: Calendar, sub: undefined as string | undefined },
          { label: 'Оплачено', value: stats.paidCount, color: '#059669', icon: DollarSign },
          { label: 'В работе', value: stats.inProgressCount, color: '#F59E0B', icon: Clock },
          { label: 'Неявки', value: stats.noShows, color: '#F97316', icon: AlertTriangle, sub: stats.noShowLoss > 0 ? `-${formatPrice(stats.noShowLoss)}` : undefined },
          { label: 'Отмены', value: stats.cancelledCount, color: '#DC2626', icon: AlertTriangle, sub: stats.cancelledLoss > 0 ? `-${formatPrice(stats.cancelledLoss)}` : undefined },
        ]).map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="w-4 h-4" style={{ color: card.color }} />
              <span className="text-[#6B7280] uppercase" style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.05em' }}>{card.label}</span>
            </div>
            <p className="text-[#111827]" style={{ fontSize: '28px', fontWeight: 700 }}>{card.value}</p>
            {card.sub && <p className="text-[#DC2626]" style={{ fontSize: '11px', fontWeight: 500 }}>{card.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Week Revenue Chart */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <h3 className="text-[#111827] mb-4" style={{ fontSize: '15px', fontWeight: 600 }}>Выручка за неделю</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekRevenue ?? []} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatPrice(v)} labelStyle={{ color: '#111827' }} />
              <Bar dataKey="revenue" fill="#2D6BE4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Pie */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <h3 className="text-[#111827] mb-4" style={{ fontSize: '15px', fontWeight: 600 }}>Способы оплаты</h3>
          <div className="flex items-center gap-4">
            <div className="w-[160px] h-[160px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.paymentBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {stats.paymentBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 flex-1">
              {stats.paymentBreakdown.map(p => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
                    <span className="text-[#6B7280]" style={{ fontSize: '13px' }}>{p.name}</span>
                  </div>
                  <span className="text-[#111827]" style={{ fontSize: '13px', fontWeight: 600 }}>{formatPrice(p.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Box Utilization */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <h3 className="text-[#111827] mb-4" style={{ fontSize: '15px', fontWeight: 600 }}>Загрузка боксов</h3>
          <div className="space-y-3">
            {stats.boxUtil.map(box => (
              <div key={box.name}>
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: box.color }} />
                    <span className="text-[#111827]" style={{ fontSize: '13px', fontWeight: 500 }}>{box.name}</span>
                  </div>
                  <span className="text-[#6B7280]" style={{ fontSize: '13px', fontWeight: 600 }}>{box.pct}%</span>
                </div>
                <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${box.pct}%`,
                    backgroundColor: box.pct >= 70 ? '#059669' : box.pct >= 50 ? '#1B4F8A' : '#D97706',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Services */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <h3 className="text-[#111827] mb-4" style={{ fontSize: '15px', fontWeight: 600 }}>Топ услуги</h3>
          <div className="space-y-2.5">
            {stats.svcRevenue.map((svc, i) => (
              <div key={svc.name} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] shrink-0" style={{ fontSize: '11px', fontWeight: 600 }}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[#111827] truncate" style={{ fontSize: '13px', fontWeight: 500 }}>{svc.name}</p>
                    <p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>{svc.count} записей</p>
                  </div>
                </div>
                <span className="text-[#111827] shrink-0" style={{ fontSize: '13px', fontWeight: 600 }}>{formatPrice(svc.revenue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Masters */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <h3 className="text-[#111827] mb-4" style={{ fontSize: '15px', fontWeight: 600 }}>Рейтинг мастеров</h3>
          <div className="space-y-3">
            {stats.masterStats.map((m, i) => (
              <div key={m.name} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? 'bg-[#FEF3C7]' : 'bg-[#F3F4F6]'}`}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: i === 0 ? '#D97706' : '#6B7280' }}>{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#111827]" style={{ fontSize: '13px', fontWeight: 500 }}>{m.name}</p>
                  <p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>{m.count} записей</p>
                </div>
                <span className="text-[#059669] shrink-0" style={{ fontSize: '14px', fontWeight: 600 }}>{formatPrice(m.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Шахматка', desc: 'Расписание боксов', to: '/schedule', color: '#2D6BE4' },
          { label: 'Клиенты', desc: `${clients.length} в базе`, to: '/clients', color: '#1B4F8A' },
          { label: 'Зарплаты', desc: 'Баланс мастеров', to: '/salary', color: '#059669' },
          { label: 'Аудит', desc: 'Лог действий', to: '/audit', color: '#6B7280' },
        ].map(action => (
          <button
            key={action.label}
            onClick={() => navigate(action.to)}
            className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-left hover:shadow-md transition-shadow group"
          >
            <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 600 }}>{action.label}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[#6B7280]" style={{ fontSize: '12px' }}>{action.desc}</span>
              <ArrowRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#2D6BE4] transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
