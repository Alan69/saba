import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Building2, Loader2, LogOut, RefreshCw, Search } from 'lucide-react';
import { apiGet, apiPatch, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatPrice, formatAuditAction, AUDIT_ENTITY_LABELS } from '../../lib/mock-data';
import { CompanyDrawer } from './superadmin-company';

interface AdminCompany {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  city?: string | null;
  plan: 'light' | 'business';
  mode: 'active' | 'read_only' | 'frozen';
  isTrial: boolean;
  planExpiresAt?: string | null;
  createdAt: string;
  owner?: { name: string; phone: string } | null;
  counts: { users: number; employees: number; clients: number; appointments: number };
}

interface Overview {
  companies: number; users: number; appointments: number;
  active: number; readOnly: number; frozen: number;
  newCompanies30d: number; appointments30d: number; appointmentsToday: number; revenue30d: number;
}

interface Analytics {
  days: number;
  signups: { day: string; n: number }[];
  appointments: { day: string; n: number }[];
  topCompanies: { id: string; name: string; appointments: number; revenue: number }[];
}

interface AuditRow {
  id: string; companyId: string; companyName: string; actorName: string;
  action: string; entity: string; createdAt: string;
}

const TABS = [
  { key: 'companies', label: 'Компании' },
  { key: 'analytics', label: 'Аналитика' },
  { key: 'audit', label: 'Аудит' },
] as const;
type Tab = (typeof TABS)[number]['key'];

const MODES = [
  { key: 'active', label: 'Активна', color: '#059669', bg: '#ECFDF5' },
  { key: 'read_only', label: 'Только чтение', color: '#D97706', bg: '#FFFBEB' },
  { key: 'frozen', label: 'Заморожена', color: '#DC2626', bg: '#FEF2F2' },
] as const;

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

export function SuperadminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('companies');
  const [openId, setOpenId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const [list, stats] = await Promise.all([
        apiGet<AdminCompany[]>(`/admin/companies${q ? `?search=${encodeURIComponent(q)}` : ''}`),
        apiGet<Overview>('/admin/overview'),
      ]);
      setCompanies(list);
      setOverview(stats);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search.trim()), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, load]);

  useEffect(() => {
    if (tab === 'analytics' && !analytics) {
      apiGet<Analytics>('/admin/analytics').then(setAnalytics).catch(() => toast.error('Аналитика недоступна'));
    }
    if (tab === 'audit' && !audit) {
      apiGet<AuditRow[]>('/admin/audit?limit=100').then(setAudit).catch(() => toast.error('Аудит недоступен'));
    }
  }, [tab, analytics, audit]);

  const patch = async (id: string, body: Partial<Pick<AdminCompany, 'mode' | 'plan' | 'isTrial'>>) => {
    setSavingId(id);
    try {
      const res = await apiPatch(`/admin/companies/${id}`, body);
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...res } : c)));
      apiGet<Overview>('/admin/overview').then(setOverview).catch(() => {});
      toast.success('Сохранено');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить');
    } finally {
      setSavingId(null);
    }
  };

  const stats = overview && [
    { label: 'Компаний', value: overview.companies, hint: `+${overview.newCompanies30d} за 30 дней` },
    { label: 'Активных', value: overview.active, color: '#059669' },
    { label: 'Только чтение', value: overview.readOnly, color: '#D97706' },
    { label: 'Заморожено', value: overview.frozen, color: '#DC2626' },
    { label: 'Записей всего', value: overview.appointments, hint: `${overview.appointments30d} за 30 дней` },
    { label: 'Записей сегодня', value: overview.appointmentsToday },
    { label: 'Пользователей', value: overview.users },
    { label: 'Выручка 30д', value: formatPrice(overview.revenue30d), color: '#059669' },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB]" style={{ fontFamily: 'Inter, sans-serif' }}>
      <header className="bg-[#0D1F3C] text-white">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <span style={{ fontSize: '15px', fontWeight: 700 }}>S</span>
            </div>
            <span style={{ fontSize: '17px', fontWeight: 700 }}>saba</span>
            <span className="px-2 py-0.5 rounded bg-white/10 text-white/80" style={{ fontSize: '11px', fontWeight: 600 }}>
              ПЛАТФОРМА
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/70 hidden sm:block" style={{ fontSize: '13px' }}>{user?.name}</span>
            <button onClick={() => { logout(); navigate('/login'); }} title="Выйти"
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-4 lg:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[#111827]" style={{ fontSize: '24px', fontWeight: 700 }}>Компании</h1>
            <p className="text-[#6B7280] mt-0.5" style={{ fontSize: '13px' }}>Все тенанты платформы</p>
          </div>
          <button onClick={() => load(search.trim())} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] disabled:opacity-50"
            style={{ fontSize: '13px', fontWeight: 500 }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Обновить
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                <div className="text-[#6B7280]" style={{ fontSize: '12px' }}>{s.label}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: s.color ?? '#111827' }}>{s.value}</div>
                {s.hint && <div className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>{s.hint}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1 p-1 rounded-lg bg-[#F3F4F6] w-fit mb-4">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md transition-colors ${tab === t.key ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}
              style={{ fontSize: '13px', fontWeight: 500 }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'companies' && (<>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию, slug или телефону..."
            className="w-full lg:max-w-[420px] pl-9 pr-4 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:border-[#2D6BE4]"
            style={{ fontSize: '13px' }} />
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-left text-[#6B7280]" style={{ fontSize: '12px' }}>
                <th className="px-4 py-3 font-medium">Компания</th>
                <th className="px-4 py-3 font-medium">Режим</th>
                <th className="px-4 py-3 font-medium">Тариф</th>
                <th className="px-4 py-3 font-medium">Владелец</th>
                <th className="px-4 py-3 font-medium">Данные</th>
                <th className="px-4 py-3 font-medium">Создана</th>
              </tr>
            </thead>
            <tbody>
              {loading && companies.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-[#9CA3AF]">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </td></tr>
              )}
              {!loading && companies.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-[#9CA3AF]" style={{ fontSize: '13px' }}>
                  <Building2 className="w-6 h-6 mx-auto mb-2" />
                  Компаний нет
                </td></tr>
              )}
              {companies.map((c) => (
                <tr key={c.id} className={`border-b border-[#F3F4F6] last:border-0 ${savingId === c.id ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 cursor-pointer" onClick={() => setOpenId(c.id)}>
                    <div className="text-[#2D6BE4] hover:underline" style={{ fontSize: '13px', fontWeight: 600 }}>{c.name}</div>
                    <div className="text-[#9CA3AF]" style={{ fontSize: '12px' }}>
                      /{c.slug}{c.city ? ` · ${c.city}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select value={c.mode} disabled={savingId === c.id}
                      onChange={(e) => patch(c.id, { mode: e.target.value as AdminCompany['mode'] })}
                      className="px-2 py-1.5 rounded-lg border font-medium" style={{
                        fontSize: '12px',
                        color: MODES.find((m) => m.key === c.mode)?.color,
                        backgroundColor: MODES.find((m) => m.key === c.mode)?.bg,
                        borderColor: MODES.find((m) => m.key === c.mode)?.color,
                      }}>
                      {MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select value={c.plan} disabled={savingId === c.id}
                      onChange={(e) => patch(c.id, { plan: e.target.value as AdminCompany['plan'] })}
                      className="px-2 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827]" style={{ fontSize: '12px' }}>
                      <option value="light">Light</option>
                      <option value="business">Business</option>
                    </select>
                    <div className="text-[#9CA3AF] mt-1" style={{ fontSize: '11px' }}>
                      {c.isTrial ? `триал до ${fmtDate(c.planExpiresAt)}` : `до ${fmtDate(c.planExpiresAt)}`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[#111827]" style={{ fontSize: '13px' }}>{c.owner?.name ?? '—'}</div>
                    <div className="text-[#9CA3AF]" style={{ fontSize: '12px' }}>{c.owner?.phone ?? c.phone ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 text-[#6B7280]" style={{ fontSize: '12px' }}>
                    {c.counts.employees} сотр. · {c.counts.clients} кл. · {c.counts.appointments} зап.
                  </td>
                  <td className="px-4 py-3 text-[#6B7280]" style={{ fontSize: '12px' }}>{fmtDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>)}

        {tab === 'analytics' && (
          !analytics ? <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[#9CA3AF]" /></div> : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[
                  { title: `Регистрации компаний, ${analytics.days} дн.`, data: analytics.signups, color: '#2D6BE4' },
                  { title: `Новые записи, ${analytics.days} дн.`, data: analytics.appointments, color: '#059669' },
                ].map((chart) => (
                  <div key={chart.title} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <div className="text-[#111827] mb-3" style={{ fontSize: '14px', fontWeight: 600 }}>{chart.title}</div>
                    {chart.data.length === 0 ? (
                      <div className="h-[200px] flex items-center justify-center text-[#9CA3AF]" style={{ fontSize: '13px' }}>
                        Данных пока нет
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chart.data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                          <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(d: string) => d.slice(5)} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} width={28} />
                          <Tooltip labelFormatter={(d) => `Дата: ${d}`} formatter={(v: number) => [v, 'шт.']} />
                          <Bar dataKey="n" fill={chart.color} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                <div className="text-[#111827] mb-3" style={{ fontSize: '14px', fontWeight: 600 }}>
                  Топ компаний по записям ({analytics.days} дн.)
                </div>
                {analytics.topCompanies.length === 0 ? (
                  <div className="text-[#9CA3AF]" style={{ fontSize: '13px' }}>Данных пока нет</div>
                ) : analytics.topCompanies.map((c, i) => (
                  <button key={c.id} onClick={() => setOpenId(c.id)}
                    className="w-full flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] text-left">
                    <div className="flex items-center gap-3">
                      <span className="text-[#9CA3AF] w-5" style={{ fontSize: '12px' }}>{i + 1}</span>
                      <span className="text-[#111827]" style={{ fontSize: '13px', fontWeight: 500 }}>{c.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[#6B7280]" style={{ fontSize: '12px' }}>{c.appointments} зап.</span>
                      <span className="text-[#059669]" style={{ fontSize: '13px', fontWeight: 600 }}>{formatPrice(c.revenue)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        {tab === 'audit' && (
          !audit ? <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[#9CA3AF]" /></div> : (
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-left text-[#6B7280]" style={{ fontSize: '12px' }}>
                    <th className="px-4 py-3 font-medium">Компания</th>
                    <th className="px-4 py-3 font-medium">Действие</th>
                    <th className="px-4 py-3 font-medium">Объект</th>
                    <th className="px-4 py-3 font-medium">Кто</th>
                    <th className="px-4 py-3 font-medium">Когда</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-[#9CA3AF]" style={{ fontSize: '13px' }}>
                      Событий нет
                    </td></tr>
                  )}
                  {audit.map((e) => (
                    <tr key={e.id} onClick={() => setOpenId(e.companyId)}
                      className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] cursor-pointer">
                      <td className="px-4 py-3 text-[#111827]" style={{ fontSize: '13px', fontWeight: 500 }}>{e.companyName}</td>
                      <td className="px-4 py-3 text-[#111827]" style={{ fontSize: '13px' }}>{formatAuditAction(e.action)}</td>
                      <td className="px-4 py-3 text-[#6B7280]" style={{ fontSize: '12px' }}>{AUDIT_ENTITY_LABELS[e.entity] ?? e.entity}</td>
                      <td className="px-4 py-3 text-[#6B7280]" style={{ fontSize: '12px' }}>{e.actorName}</td>
                      <td className="px-4 py-3 text-[#9CA3AF]" style={{ fontSize: '12px' }}>
                        {new Date(e.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {openId && (
        <CompanyDrawer id={openId} onClose={() => setOpenId(null)}
          onChanged={() => { load(search.trim()); setAudit(null); setAnalytics(null); }} />
      )}
    </div>
  );
}
