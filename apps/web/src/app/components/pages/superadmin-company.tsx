import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Key, Loader2, LogIn, Trash2, X } from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost, ApiError, startImpersonation } from '../../lib/api';
import { formatPrice, STATUS_COLORS, STATUS_LABELS, formatAuditAction, type AppointmentStatus } from '../../lib/mock-data';

interface Detail {
  company: {
    id: string; name: string; slug: string; phone?: string | null; address?: string | null;
    city?: string | null; timezone: string; plan: string; mode: string; isTrial: boolean;
    planExpiresAt?: string | null; wizardDone: boolean; createdAt: string;
  };
  users: { id: string; name: string; phone: string; role: string; createdAt: string }[];
  counts: { employees: number; boxes: number; services: number; clients: number; appointments: number };
  revenue30d: number;
  byStatus: Record<string, number>;
  lastAppointments: {
    id: string; code: string; startAt: string; status: AppointmentStatus; price: number; source: string;
    client?: { name: string; phone: string } | null; service?: { name: string } | null;
  }[];
  audit: { id: string; actorName: string; action: string; entity: string; createdAt: string }[];
}

const ROLE_LABELS: Record<string, string> = { owner: 'Владелец', admin: 'Администратор' };

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function CompanyDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [expires, setExpires] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await apiGet<Detail>(`/admin/companies/${id}`);
      setData(d);
      setExpires(d.company.planExpiresAt ? d.company.planExpiresAt.slice(0, 10) : '');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить компанию');
      onClose();
    }
  }, [id, onClose]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const saveExpiry = () => act(async () => {
    try {
      await apiPatch(`/admin/companies/${id}`, { planExpiresAt: new Date(`${expires}T12:00:00Z`).toISOString() });
      toast.success('Срок тарифа обновлён');
      onChanged();
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить');
    }
  });

  const impersonate = () => act(async () => {
    try {
      const res = await apiPost(`/admin/companies/${id}/impersonate`);
      startImpersonation(res.accessToken, res.refreshToken);
      window.location.href = `${import.meta.env.BASE_URL}schedule`;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось войти');
    }
  });

  const resetPassword = () => act(async () => {
    try {
      const res = await apiPost(`/admin/companies/${id}/reset-owner-password`);
      toast.success(`Новый пароль для ${res.phone}: ${res.password}`, { duration: 60_000 });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сбросить пароль');
    }
  });

  const remove = () => {
    if (!confirm(`Удалить компанию «${data?.company.name}»? Данные останутся в БД, доступ будет закрыт.`)) return;
    act(async () => {
      try {
        await apiDelete(`/admin/companies/${id}`);
        toast.success('Компания удалена');
        onChanged();
        onClose();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-[560px] h-full bg-[#F9FAFB] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        {!data ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#9CA3AF]" /></div>
        ) : (
          <>
            <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-5 py-4 flex items-start justify-between">
              <div>
                <div className="text-[#111827]" style={{ fontSize: '18px', fontWeight: 700 }}>{data.company.name}</div>
                <div className="text-[#9CA3AF]" style={{ fontSize: '12px' }}>
                  /{data.company.slug} · {data.company.city ?? 'город не указан'} · {data.company.timezone}
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F3F4F6] flex items-center justify-center">
                <X className="w-4 h-4 text-[#6B7280]" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: 'Сотрудники', v: data.counts.employees },
                  { l: 'Боксы', v: data.counts.boxes },
                  { l: 'Услуги', v: data.counts.services },
                  { l: 'Клиенты', v: data.counts.clients },
                  { l: 'Записи', v: data.counts.appointments },
                  { l: 'Выручка 30д', v: formatPrice(data.revenue30d) },
                ].map((s) => (
                  <div key={s.l} className="bg-white rounded-xl border border-[#E5E7EB] p-3">
                    <div className="text-[#6B7280]" style={{ fontSize: '11px' }}>{s.l}</div>
                    <div className="text-[#111827]" style={{ fontSize: '16px', fontWeight: 700 }}>{s.v}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                <div className="text-[#111827] mb-3" style={{ fontSize: '14px', fontWeight: 600 }}>Тариф</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-1 rounded bg-[#F3F4F6] text-[#6B7280]" style={{ fontSize: '12px' }}>
                    {data.company.plan === 'business' ? 'Business' : 'Light'}{data.company.isTrial ? ' · триал' : ''}
                  </span>
                  <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827]" style={{ fontSize: '13px' }} />
                  <button onClick={saveExpiry} disabled={busy || !expires}
                    className="px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] disabled:opacity-50"
                    style={{ fontSize: '13px', fontWeight: 500 }}>
                    Продлить до
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                <div className="text-[#111827] mb-3" style={{ fontSize: '14px', fontWeight: 600 }}>Действия поддержки</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={impersonate} disabled={busy}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2D6BE4] text-white disabled:opacity-50"
                    style={{ fontSize: '13px', fontWeight: 500 }}>
                    <LogIn className="w-4 h-4" /> Войти как компания
                  </button>
                  <button onClick={resetPassword} disabled={busy}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] disabled:opacity-50"
                    style={{ fontSize: '13px', fontWeight: 500 }}>
                    <Key className="w-4 h-4" /> Сбросить пароль владельца
                  </button>
                  <button onClick={remove} disabled={busy}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] disabled:opacity-50"
                    style={{ fontSize: '13px', fontWeight: 500 }}>
                    <Trash2 className="w-4 h-4" /> Удалить
                  </button>
                </div>
                <p className="text-[#9CA3AF] mt-2" style={{ fontSize: '11px' }}>
                  Все действия попадают в аудит компании.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                <div className="text-[#111827] mb-3" style={{ fontSize: '14px', fontWeight: 600 }}>
                  Пользователи ({data.users.length})
                </div>
                <div className="space-y-2">
                  {data.users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between">
                      <div>
                        <div className="text-[#111827]" style={{ fontSize: '13px' }}>{u.name}</div>
                        <div className="text-[#9CA3AF]" style={{ fontSize: '12px' }}>{u.phone}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280]" style={{ fontSize: '11px' }}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                <div className="text-[#111827] mb-3" style={{ fontSize: '14px', fontWeight: 600 }}>Последние записи</div>
                {data.lastAppointments.length === 0 ? (
                  <div className="text-[#9CA3AF]" style={{ fontSize: '13px' }}>Записей нет</div>
                ) : data.lastAppointments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-[#F3F4F6] last:border-0">
                    <div>
                      <div className="text-[#111827]" style={{ fontSize: '13px' }}>
                        {a.client?.name ?? 'Без клиента'} · {a.service?.name ?? '—'}
                      </div>
                      <div className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>{fmtDateTime(a.startAt)} · {a.code}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#111827]" style={{ fontSize: '13px', fontWeight: 600 }}>{formatPrice(a.price)}</div>
                      <span style={{ fontSize: '11px', color: STATUS_COLORS[a.status] }}>{STATUS_LABELS[a.status]}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                <div className="text-[#111827] mb-3" style={{ fontSize: '14px', fontWeight: 600 }}>Аудит компании</div>
                {data.audit.length === 0 ? (
                  <div className="text-[#9CA3AF]" style={{ fontSize: '13px' }}>Событий нет</div>
                ) : data.audit.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-[#F3F4F6] last:border-0">
                    <div className="text-[#111827]" style={{ fontSize: '13px' }}>
                      {formatAuditAction(e.action)} <span className="text-[#9CA3AF]">· {e.actorName}</span>
                    </div>
                    <div className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>{fmtDateTime(e.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
