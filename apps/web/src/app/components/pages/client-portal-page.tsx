import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Loader2, LogOut, Calendar, Clock, Car, ChevronLeft, Plus, Trash2, X,
} from 'lucide-react';
import {
  apiPublic, apiPublicPost, clientApi, getClientToken, setClientToken, ApiError,
} from '../../lib/api';
import { formatPrice, STATUS_LABELS, STATUS_COLORS, type CarSize } from '../../lib/mock-data';

interface CarSizeOption { key: CarSize; label: string; examples: string }

interface Appt {
  id: string; code: string; status: keyof typeof STATUS_LABELS;
  startAt: string; endAt: string; price: number;
  service?: string; master?: string; box?: string; car?: string; cancellable: boolean;
}
interface ClientCar { id: string; brand: string; plateNumber?: string; size: CarSize }
interface Profile {
  client: { id: string; name?: string; phone: string; visitsCount: number; totalSpent: number };
  company: { name: string; slug: string; accentColor?: string };
  cars: ClientCar[];
  upcoming: Appt[];
  history: Appt[];
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export function ClientPortalPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<{ name: string; accentColor?: string } | null>(null);
  const [carSizes, setCarSizes] = useState<CarSizeOption[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authed, setAuthed] = useState(Boolean(slug && getClientToken(slug)));
  const [loading, setLoading] = useState(true);
  const accent = company?.accentColor || profile?.company.accentColor || '#2D6BE4';

  useEffect(() => {
    if (!slug) return;
    apiPublic(`/widget/${slug}`).then((d) => {
      setCompany({ name: d.name, accentColor: d.accentColor });
      setCarSizes(d.carSizes ?? []);
    }).catch(() => {});
  }, [slug]);

  const loadProfile = async () => {
    if (!slug) return;
    try {
      setProfile(await clientApi(slug, '/client/me'));
      setAuthed(true);
    } catch {
      setClientToken(slug, null);
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed) void loadProfile();
    else setLoading(false);
  }, [authed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#2D6BE4] animate-spin" />
      </div>
    );
  }

  if (!authed || !profile) {
    return <LoginView slug={slug!} companyName={company?.name} accent={accent} onAuthed={() => setAuthed(true)} />;
  }

  return (
    <PortalView
      slug={slug!}
      profile={profile}
      carSizes={carSizes}
      accent={accent}
      onReload={loadProfile}
      onLogout={() => { setClientToken(slug!, null); setAuthed(false); setProfile(null); }}
      onBookAgain={() => navigate(`/booking/${slug}`)}
    />
  );
}

function LoginView({ slug, companyName, accent, onAuthed }: {
  slug: string; companyName?: string; accent: string; onAuthed: () => void;
}) {
  const [phone, setPhone] = useState('+7');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);

  const sendOtp = async () => {
    setBusy(true);
    try {
      const res = await apiPublicPost(`/client/${slug}/send-otp`, { phone: phone.replace(/[^\d+]/g, '') });
      setStep('code');
      // dev-стаб: WABA нет — показываем код прямо в интерфейсе
      if (res.devCode) toast.info(`Код (демо): ${res.devCode}`, { duration: 15000 });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Не удалось отправить код');
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const res = await apiPublicPost(`/client/${slug}/verify-otp`, {
        phone: phone.replace(/[^\d+]/g, ''), code: code.trim(),
      });
      setClientToken(slug, res.token);
      onAuthed();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Неверный код');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center px-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: accent }}>
        <span className="text-white" style={{ fontSize: '24px', fontWeight: 700 }}>{(companyName ?? 'S')[0]}</span>
      </div>
      <h1 className="text-[#111827]" style={{ fontSize: '22px', fontWeight: 700 }}>{companyName ?? 'Личный кабинет'}</h1>
      <p className="text-[#6B7280] mb-6" style={{ fontSize: '14px' }}>Личный кабинет клиента</p>

      <div className="w-full max-w-[380px] bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
        {step === 'phone' ? (
          <>
            <h2 className="text-[#111827]" style={{ fontSize: '18px', fontWeight: 600 }}>Войти по номеру</h2>
            <p className="text-[#6B7280] mt-1 mb-4" style={{ fontSize: '13px' }}>Мы отправим код в WhatsApp</p>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 700 000 00 00"
              className="w-full px-4 py-3.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none" style={{ fontSize: '16px' }} />
            <button onClick={sendOtp} disabled={busy || phone.replace(/\D/g, '').length < 10}
              className="w-full mt-4 py-3.5 rounded-lg text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ fontSize: '15px', fontWeight: 600, backgroundColor: accent }}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Получить код
            </button>
            <p className="text-center text-[#9CA3AF] mt-3" style={{ fontSize: '12px' }}>
              OTP с системного номера Saba · Не лимитируется планом мойки
            </p>
          </>
        ) : (
          <>
            <button onClick={() => setStep('phone')} className="flex items-center gap-1 text-[#6B7280] mb-3" style={{ fontSize: '13px' }}>
              <ChevronLeft className="w-4 h-4" /> {phone}
            </button>
            <h2 className="text-[#111827]" style={{ fontSize: '18px', fontWeight: 600 }}>Введите код</h2>
            <p className="text-[#6B7280] mt-1 mb-4" style={{ fontSize: '13px' }}>6-значный код из WhatsApp</p>
            <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••" autoFocus
              className="w-full px-4 py-3.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-center text-[#111827] focus:outline-none"
              style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '0.3em' }} />
            <button onClick={verify} disabled={busy || code.length < 6}
              className="w-full mt-4 py-3.5 rounded-lg text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ fontSize: '15px', fontWeight: 600, backgroundColor: accent }}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Войти
            </button>
          </>
        )}
      </div>
      <p className="text-[#9CA3AF] mt-6" style={{ fontSize: '12px' }}>Powered by Saba</p>
    </div>
  );
}

function PortalView({ slug, profile, carSizes, accent, onReload, onLogout, onBookAgain }: {
  slug: string; profile: Profile; carSizes: CarSizeOption[]; accent: string;
  onReload: () => void; onLogout: () => void; onBookAgain: () => void;
}) {
  const [tab, setTab] = useState<'upcoming' | 'history' | 'cars'>('upcoming');
  const { client, company, upcoming, history, cars } = profile;

  const cancel = async (id: string) => {
    try {
      await clientApi(slug, `/client/appointments/${id}/cancel`, { method: 'POST' });
      toast.success('Запись отменена');
      onReload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Не удалось отменить');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="bg-white border-b border-[#E5E7EB] px-4 py-3">
        <div className="max-w-[560px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: accent }}>
              <span className="text-white" style={{ fontSize: '15px', fontWeight: 700 }}>{company.name[0]}</span>
            </div>
            <div>
              <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 700 }}>{company.name}</p>
              <p className="text-[#6B7280]" style={{ fontSize: '11px' }}>Личный кабинет</p>
            </div>
          </div>
          <button onClick={onLogout} className="p-2 rounded-lg hover:bg-[#F3F4F6] text-[#6B7280]"><LogOut className="w-4.5 h-4.5" /></button>
        </div>
      </div>

      <div className="max-w-[560px] mx-auto px-4 py-5">
        <h1 className="text-[#111827]" style={{ fontSize: '22px', fontWeight: 700 }}>
          Здравствуйте{client.name ? `, ${client.name}` : ''}!
        </h1>
        <p className="text-[#6B7280] mt-0.5" style={{ fontSize: '13px' }}>
          {client.visitsCount} визитов · {formatPrice(Number(client.totalSpent))} за всё время
        </p>

        <button onClick={onBookAgain}
          className="w-full mt-4 py-3.5 rounded-xl text-white flex items-center justify-center gap-2"
          style={{ fontSize: '15px', fontWeight: 600, backgroundColor: accent }}>
          <Calendar className="w-4.5 h-4.5" /> Записаться снова
        </button>

        <div className="flex gap-1 bg-[#F3F4F6] rounded-lg p-0.5 mt-5">
          {([['upcoming', `Предстоящие (${upcoming.length})`], ['history', `История (${history.length})`], ['cars', `Мои авто (${cars.length})`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 py-2 rounded-md transition-colors ${tab === k ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}
              style={{ fontSize: '12px', fontWeight: 600 }}>{l}</button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {tab === 'upcoming' && (upcoming.length === 0
            ? <Empty text="Нет предстоящих записей" />
            : upcoming.map((a) => <ApptCard key={a.id} a={a} accent={accent} onCancel={() => cancel(a.id)} />))}

          {tab === 'history' && (history.length === 0
            ? <Empty text="История пуста" />
            : history.map((a) => <ApptCard key={a.id} a={a} accent={accent} />))}

          {tab === 'cars' && (
            <CarsTab slug={slug} cars={cars} carSizes={carSizes} accent={accent} onReload={onReload} />
          )}
        </div>
      </div>
      <p className="text-center text-[#9CA3AF] py-4" style={{ fontSize: '12px' }}>Powered by Saba</p>
    </div>
  );
}

function ApptCard({ a, accent, onCancel }: { a: Appt; accent: string; onCancel?: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[#111827]" style={{ fontSize: '15px', fontWeight: 600 }}>{a.service ?? 'Услуга'}</p>
          {a.master && <p className="text-[#6B7280]" style={{ fontSize: '12px' }}>Мастер: {a.master}</p>}
        </div>
        <span className="px-2 py-0.5 rounded-full text-white shrink-0" style={{ fontSize: '10px', fontWeight: 600, backgroundColor: STATUS_COLORS[a.status] }}>
          {STATUS_LABELS[a.status]}
        </span>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3 text-[#6B7280]" style={{ fontSize: '12px' }}>
          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {fmtDate(a.startAt)}</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {fmtTime(a.startAt)}</span>
        </div>
        <span className="text-[#111827]" style={{ fontSize: '15px', fontWeight: 700 }}>{formatPrice(Number(a.price))}</span>
      </div>
      {onCancel && a.cancellable && (
        <button onClick={onCancel} className="w-full mt-3 py-2.5 rounded-lg border border-[#DC2626] text-[#DC2626]" style={{ fontSize: '13px', fontWeight: 500 }}>
          Отменить запись
        </button>
      )}
    </div>
  );
}

function CarsTab({ slug, cars, carSizes, accent, onReload }: {
  slug: string; cars: ClientCar[]; carSizes: CarSizeOption[]; accent: string; onReload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [brand, setBrand] = useState('');
  const [plate, setPlate] = useState('');
  const [size, setSize] = useState<CarSize>('M');
  const sizeKeys = carSizes.length ? carSizes : [{ key: 'S' }, { key: 'M' }, { key: 'L' }, { key: 'XL' }] as CarSizeOption[];

  const add = async () => {
    if (!brand.trim()) { toast.error('Укажите марку'); return; }
    try {
      await clientApi(slug, '/client/cars', { method: 'POST', body: { brand: brand.trim(), plateNumber: plate || undefined, size } });
      setAdding(false); setBrand(''); setPlate(''); setSize('M');
      onReload();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Ошибка'); }
  };

  const del = async (id: string) => {
    try { await clientApi(slug, `/client/cars/${id}`, { method: 'DELETE' }); onReload(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Ошибка'); }
  };

  return (
    <>
      {cars.map((c) => (
        <div key={c.id} className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center"><Car className="w-5 h-5 text-[#6B7280]" /></div>
            <div>
              <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 600 }}>{c.brand}</p>
              <p className="text-[#6B7280]" style={{ fontSize: '12px' }}>{c.plateNumber || '— '} · размер {c.size}</p>
            </div>
          </div>
          <button onClick={() => del(c.id)} className="p-2 text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}

      {adding ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-3">
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Марка (напр. Toyota Camry)"
            className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
          <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="Госномер (необязательно)"
            className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
          <div className="flex gap-2">
            {sizeKeys.map((s) => (
              <button key={s.key} onClick={() => setSize(s.key)}
                className={`flex-1 py-2 rounded-lg border ${size === s.key ? 'text-white' : 'border-[#E5E7EB] text-[#6B7280]'}`}
                style={size === s.key ? { backgroundColor: accent, borderColor: accent, fontSize: '13px', fontWeight: 600 } : { fontSize: '13px' }}>
                {s.key}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] text-[#6B7280]" style={{ fontSize: '13px' }}>Отмена</button>
            <button onClick={add} className="flex-1 py-2.5 rounded-lg text-white" style={{ fontSize: '13px', fontWeight: 600, backgroundColor: accent }}>Сохранить</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full py-3 rounded-xl border border-dashed border-[#D1D5DB] text-[#6B7280] flex items-center justify-center gap-2" style={{ fontSize: '14px', fontWeight: 500 }}>
          <Plus className="w-4 h-4" /> Добавить авто
        </button>
      )}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] py-10 text-center text-[#9CA3AF]" style={{ fontSize: '14px' }}>
      {text}
    </div>
  );
}
