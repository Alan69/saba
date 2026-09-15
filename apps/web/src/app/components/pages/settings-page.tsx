import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, ExternalLink, Plus, Trash2, GripVertical, Edit3, Save } from 'lucide-react';
import { useStore } from '../../lib/store';
import { useAuth } from '../../lib/auth';
import { apiPatch, apiPost, ApiError } from '../../lib/api';
import { formatPrice, type CarSize } from '../../lib/mock-data';

const TABS = ['Компания', 'Боксы', 'Услуги', 'Сотрудники', 'Типы авто', 'Режим работы', 'Виджет', 'Безопасность'];
const DAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const BOX_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1'];

interface CarSizeRow { key: CarSize; label: string; examples: string; enabled: boolean }
const DEFAULT_CAR_SIZES: CarSizeRow[] = [
  { key: 'S', label: 'Седан', examples: 'Toyota Camry, Kia Cerato', enabled: true },
  { key: 'M', label: 'Кроссовер', examples: 'Hyundai Tucson, Kia Sportage', enabled: true },
  { key: 'L', label: 'Внедорожник', examples: 'Toyota Land Cruiser, Lexus LX', enabled: true },
  { key: 'XL', label: 'Минивен', examples: 'Toyota Alphard, Kia Carnival', enabled: true },
];

export function SettingsPage() {
  const store = useStore();
  const { company, refreshCompany } = useAuth();
  const [activeTab, setActiveTab] = useState('Компания');
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [timezone, setTimezone] = useState('Asia/Almaty');
  const [schedule, setSchedule] = useState(
    DAYS_FULL.map((d, i) => ({ day: d, active: i < 6, start: '09:00', end: '20:00' }))
  );
  const [accentColor, setAccentColor] = useState('#2D6BE4');
  const [slug, setSlug] = useState('');
  const [carSizes, setCarSizes] = useState<CarSizeRow[]>(DEFAULT_CAR_SIZES);
  const [savingSizes, setSavingSizes] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [antifraudCode, setAntifraudCode] = useState('');
  const [showCode, setShowCode] = useState(false);

  // подтягиваем реальные данные компании
  useEffect(() => {
    if (!company) return;
    setCompanyName(company.name ?? '');
    setCompanyPhone(company.phone ?? '');
    setCompanyAddress(company.address ?? '');
    setTimezone(company.timezone ?? 'Asia/Almaty');
    setAccentColor(company.accentColor ?? '#2D6BE4');
    setSlug(company.slug ?? '');
    const wh = company.workingHours as Record<string, { enabled: boolean; start: string; end: string }> | undefined;
    if (wh) {
      const keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      setSchedule(DAYS_FULL.map((d, i) => ({
        day: d,
        active: wh[keys[i]]?.enabled ?? false,
        start: wh[keys[i]]?.start ?? '09:00',
        end: wh[keys[i]]?.end ?? '20:00',
      })));
    }
    const cs = (company as any).carSizes as CarSizeRow[] | undefined;
    if (cs?.length) setCarSizes(cs);
  }, [company]);

  const saveCompany = async () => {
    setSavingCompany(true);
    try {
      const keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      const workingHours = Object.fromEntries(
        schedule.map((d, i) => [keys[i], { enabled: d.active, start: d.start, end: d.end }]),
      );
      await apiPatch('/company', {
        name: companyName, phone: companyPhone, address: companyAddress,
        timezone, accentColor, workingHours,
      });
      await refreshCompany();
      toast.success('Настройки сохранены');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Ошибка сохранения');
    } finally { setSavingCompany(false); }
  };

  const saveCarSizes = async () => {
    setSavingSizes(true);
    try {
      await apiPost('/company/car-sizes', { carSizes });
      await refreshCompany();
      toast.success('Типы авто сохранены');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Ошибка сохранения');
    } finally { setSavingSizes(false); }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[900px] mx-auto">
      <h1 className="text-[#111827] mb-5" style={{ fontSize: '24px', fontWeight: 700 }}>Настройки</h1>

      <div className="flex gap-1 overflow-x-auto pb-3 mb-5 -mx-4 px-4 lg:mx-0 lg:px-0">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 rounded-lg whitespace-nowrap transition-colors shrink-0 ${activeTab === tab ? 'bg-[#0D1F3C] text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#111827]'}`}
            style={{ fontSize: '13px', fontWeight: 500 }}>{tab}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">

        {/* КОМПАНИЯ */}
        {activeTab === 'Компания' && (
          <div className="space-y-4">
            <div>
              <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Название компании</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:border-[#2D6BE4] focus:outline-none" style={{ fontSize: '14px' }} />
            </div>
            <div>
              <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Телефон</label>
              <input value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
            </div>
            <div>
              <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Адрес</label>
              <input value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
            </div>
            <div>
              <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Часовой пояс</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }}>
                <option>Asia/Almaty</option><option>Asia/Aqtau</option><option>Asia/Aqtobe</option><option>Asia/Oral</option>
              </select>
            </div>
            <button onClick={saveCompany} disabled={savingCompany} className="px-6 py-3 rounded-lg bg-[#2D6BE4] text-white disabled:opacity-60" style={{ fontSize: '14px', fontWeight: 600 }}>{savingCompany ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        )}

        {/* БОКСЫ */}
        {activeTab === 'Боксы' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#6B7280]" style={{ fontSize: '13px' }}>{store.boxes.length} боксов</p>
              <button onClick={() => {
                store.addBox({ id: `b${Date.now()}`, name: `Бокс ${store.boxes.length + 1}`, color: BOX_COLORS[store.boxes.length % BOX_COLORS.length], isActive: true, orderIndex: store.boxes.length });
                toast.success('Бокс добавлен');
              }} className="flex items-center gap-1.5 text-[#2D6BE4]" style={{ fontSize: '13px', fontWeight: 500 }}>
                <Plus className="w-4 h-4" /> Добавить
              </button>
            </div>
            {store.boxes.map(box => (
              <div key={box.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E7EB]">
                <GripVertical className="w-4 h-4 text-[#9CA3AF] cursor-grab shrink-0" />
                <input type="color" value={box.color} onChange={e => store.updateBox(box.id, { color: e.target.value })}
                  className="w-8 h-8 rounded-lg border border-[#E5E7EB] cursor-pointer shrink-0" />
                <input value={box.name} onChange={e => store.updateBox(box.id, { name: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-md border border-[#E5E7EB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
                <label className="flex items-center gap-2 shrink-0">
                  <input type="checkbox" checked={box.isActive} onChange={() => store.updateBox(box.id, { isActive: !box.isActive })} className="rounded" />
                  <span className="text-[#6B7280]" style={{ fontSize: '12px' }}>Активен</span>
                </label>
                {store.boxes.length > 1 && (
                  <button onClick={() => { store.deleteBox(box.id); toast.success('Бокс удалён'); }} className="p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* УСЛУГИ */}
        {activeTab === 'Услуги' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#6B7280]" style={{ fontSize: '13px' }}>{store.services.length} услуг</p>
              <button onClick={() => {
                store.addService({ id: `s${Date.now()}`, name: 'Новая услуга', durationMin: 30, price: 3000, priceBySize: { S: 2500, M: 3000, L: 3500, XL: 4500 } });
                toast.success('Услуга добавлена');
              }} className="flex items-center gap-1.5 text-[#2D6BE4]" style={{ fontSize: '13px', fontWeight: 500 }}>
                <Plus className="w-4 h-4" /> Добавить
              </button>
            </div>
            {store.services.map(svc => (
              <div key={svc.id} className="p-3 rounded-lg border border-[#E5E7EB] space-y-2">
                <div className="flex items-center gap-2">
                  <input value={svc.name} onChange={e => store.updateService(svc.id, { name: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-md border border-[#E5E7EB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
                  <button onClick={() => { store.deleteService(svc.id); toast.success('Услуга удалена'); }} className="p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <select value={svc.durationMin} onChange={e => store.updateService(svc.id, { durationMin: Number(e.target.value) })}
                    className="px-3 py-2 rounded-md border border-[#E5E7EB] text-[#111827]" style={{ fontSize: '13px' }}>
                    {[15, 30, 45, 60, 90, 120, 180].map(d => <option key={d} value={d}>{d} мин</option>)}
                  </select>
                  {(['S', 'M', 'L', 'XL'] as CarSize[]).map(size => (
                    <div key={size} className="flex-1">
                      <label className="text-[#9CA3AF] block" style={{ fontSize: '10px' }}>{size}</label>
                      <input value={svc.priceBySize[size]} onChange={e => {
                        const newPrices = { ...svc.priceBySize, [size]: Number(e.target.value) };
                        store.updateService(svc.id, { priceBySize: newPrices, price: newPrices.M });
                      }} className="w-full px-2 py-1.5 rounded-md border border-[#E5E7EB] text-[#111827]" style={{ fontSize: '13px' }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* СОТРУДНИКИ */}
        {activeTab === 'Сотрудники' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#6B7280]" style={{ fontSize: '13px' }}>{store.employees.length} сотрудников</p>
              <button onClick={() => {
                store.addEmployee({ id: `e${Date.now()}`, name: 'Новый мастер', role: 'master', salaryType: 'percent', salaryValue: 35 });
                toast.success('Сотрудник добавлен');
              }} className="flex items-center gap-1.5 text-[#2D6BE4]" style={{ fontSize: '13px', fontWeight: 500 }}>
                <Plus className="w-4 h-4" /> Добавить
              </button>
            </div>
            {store.employees.map(emp => (
              <div key={emp.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E7EB]">
                <div className="w-8 h-8 rounded-full bg-[#EBF0F9] flex items-center justify-center shrink-0">
                  <span className="text-[#1B4F8A]" style={{ fontSize: '12px', fontWeight: 600 }}>{emp.name[0]}</span>
                </div>
                <input value={emp.name} onChange={e => store.updateEmployee(emp.id, { name: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-md border border-[#E5E7EB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
                <select value={emp.role} onChange={e => store.updateEmployee(emp.id, { role: e.target.value as 'master' | 'admin' })}
                  className="px-2 py-2 rounded-md border border-[#E5E7EB] text-[#111827]" style={{ fontSize: '13px' }}>
                  <option value="master">Мастер</option><option value="admin">Админ</option>
                </select>
                <div className="flex items-center gap-1 shrink-0">
                  <input value={emp.salaryValue} onChange={e => store.updateEmployee(emp.id, { salaryValue: Number(e.target.value) })} type="number"
                    className="w-14 px-2 py-2 rounded-md border border-[#E5E7EB] text-[#111827] text-center" style={{ fontSize: '13px' }} />
                  <span className="text-[#9CA3AF]" style={{ fontSize: '13px' }}>%</span>
                </div>
                <button onClick={() => { store.deleteEmployee(emp.id); toast.success('Сотрудник удалён'); }} className="p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ТИПЫ АВТО */}
        {activeTab === 'Типы авто' && (
          <div className="space-y-4">
            <div>
              <p className="text-[#111827]" style={{ fontSize: '15px', fontWeight: 600 }}>Типы авто (размеры)</p>
              <p className="text-[#6B7280] mt-1" style={{ fontSize: '13px' }}>
                Клиент выбирает тип авто в виджете записи — от него зависит цена услуги (колонки S/M/L/XL в «Услугах»).
                Здесь настраиваются названия и примеры моделей. Отключённые типы не показываются в виджете.
              </p>
            </div>
            {carSizes.map((cs, i) => (
              <div key={cs.key} className="p-3 rounded-lg border border-[#E5E7EB]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0">
                    <span className="text-[#6B7280]" style={{ fontSize: '15px', fontWeight: 700 }}>{cs.key}</span>
                  </div>
                  <div className="flex-1">
                    <label className="text-[#9CA3AF] block" style={{ fontSize: '10px' }}>Название</label>
                    <input value={cs.label} onChange={e => { const c = [...carSizes]; c[i] = { ...c[i], label: e.target.value }; setCarSizes(c); }}
                      className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
                  </div>
                  <label className="flex items-center gap-2 shrink-0 mt-4">
                    <input type="checkbox" checked={cs.enabled} onChange={() => { const c = [...carSizes]; c[i] = { ...c[i], enabled: !c[i].enabled }; setCarSizes(c); }} className="rounded" />
                    <span className="text-[#6B7280]" style={{ fontSize: '12px' }}>Вкл.</span>
                  </label>
                </div>
                <div className="mt-2">
                  <label className="text-[#9CA3AF] block" style={{ fontSize: '10px' }}>Примеры моделей</label>
                  <input value={cs.examples} onChange={e => { const c = [...carSizes]; c[i] = { ...c[i], examples: e.target.value }; setCarSizes(c); }}
                    placeholder="Напр. Toyota Camry, Kia Cerato"
                    className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
                </div>
              </div>
            ))}
            <button onClick={saveCarSizes} disabled={savingSizes} className="px-6 py-3 rounded-lg bg-[#2D6BE4] text-white disabled:opacity-60" style={{ fontSize: '14px', fontWeight: 600 }}>{savingSizes ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        )}

        {/* РЕЖИМ РАБОТЫ */}
        {activeTab === 'Режим работы' && (
          <div className="space-y-3">
            {schedule.map((day, i) => (
              <div key={day.day} className="flex items-center gap-3 lg:gap-4 py-2">
                <div className="w-[100px] lg:w-[140px] shrink-0">
                  <span className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{day.day}</span>
                </div>
                <button onClick={() => { const s = [...schedule]; s[i].active = !s[i].active; setSchedule(s); }}
                  className={`w-10 h-5 rounded-full relative shrink-0 transition-colors ${day.active ? 'bg-[#2D6BE4]' : 'bg-[#E5E7EB]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${day.active ? 'left-5' : 'left-0.5'}`} />
                </button>
                {day.active ? (
                  <div className="flex items-center gap-2">
                    <input value={day.start} onChange={e => { const s = [...schedule]; s[i].start = e.target.value; setSchedule(s); }}
                      type="time" className="px-2 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827]" style={{ fontSize: '14px' }} />
                    <span className="text-[#6B7280]">—</span>
                    <input value={day.end} onChange={e => { const s = [...schedule]; s[i].end = e.target.value; setSchedule(s); }}
                      type="time" className="px-2 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827]" style={{ fontSize: '14px' }} />
                  </div>
                ) : <span className="text-[#9CA3AF]" style={{ fontSize: '14px' }}>Выходной</span>}
              </div>
            ))}
            <button onClick={saveCompany} disabled={savingCompany} className="mt-4 px-6 py-3 rounded-lg bg-[#2D6BE4] text-white disabled:opacity-60" style={{ fontSize: '14px', fontWeight: 600 }}>{savingCompany ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        )}

        {/* ВИДЖЕТ */}
        {activeTab === 'Виджет' && (
          <div className="space-y-5">
            <div>
              <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Ссылка на виджет записи</label>
              <div className="flex items-center gap-2">
                <input readOnly value={`${window.location.host}/booking/${slug}`} className="flex-1 px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#1B4F8A]" style={{ fontSize: '14px' }} />
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/booking/${slug}`); toast.success('Скопировано!'); }} className="p-3 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB]">
                  <Copy className="w-4 h-4 text-[#6B7280]" />
                </button>
                <a href={`/booking/${slug}`} target="_blank" className="p-3 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB]">
                  <ExternalLink className="w-4 h-4 text-[#6B7280]" />
                </a>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[#6B7280]" style={{ fontSize: '12px' }}>Личный кабинет клиента:</span>
                <a href={`/client/${slug}`} target="_blank" className="text-[#2D6BE4]" style={{ fontSize: '12px', fontWeight: 500 }}>{window.location.host}/client/{slug}</a>
              </div>
            </div>
            <div>
              <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Акцентный цвет</label>
              <div className="flex items-center gap-3">
                <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="w-12 h-12 rounded-lg border border-[#E5E7EB] cursor-pointer" />
                <input value={accentColor} onChange={e => setAccentColor(e.target.value)} className="px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] w-[140px]" style={{ fontSize: '14px' }} />
                <div className="flex gap-2">
                  {['#2D6BE4', '#059669', '#DC2626', '#8B5CF6', '#D97706'].map(c => (
                    <button key={c} onClick={() => setAccentColor(c)} className="w-8 h-8 rounded-lg border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: accentColor === c ? '#111827' : 'transparent' }} />
                  ))}
                </div>
              </div>
            </div>
            <button onClick={saveCompany} disabled={savingCompany} className="px-6 py-3 rounded-lg bg-[#2D6BE4] text-white disabled:opacity-60" style={{ fontSize: '14px', fontWeight: 600 }}>{savingCompany ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        )}

        {/* БЕЗОПАСНОСТЬ */}
        {activeTab === 'Безопасность' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-[#111827] mb-2" style={{ fontSize: '15px', fontWeight: 600 }}>Код анти-фрод</h3>
              <p className="text-[#6B7280] mb-3" style={{ fontSize: '13px' }}>Администратор должен ввести этот код для изменения цены ниже прайса или отмены оплаченной записи</p>
              <div className="flex items-center gap-3">
                <input type={showCode ? 'text' : 'password'} value={antifraudCode} onChange={e => setAntifraudCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4} className="px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] w-[140px] text-center" style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '0.3em' }} />
                <button onClick={() => setShowCode(!showCode)} className="text-[#2D6BE4]" style={{ fontSize: '13px', fontWeight: 500 }}>
                  {showCode ? 'Скрыть' : 'Показать'}
                </button>
                <button onClick={async () => {
                  if (antifraudCode.length !== 4) { toast.error('Код — 4 цифры'); return; }
                  try { await apiPost('/company/price-code', { code: antifraudCode }); toast.success('Код сохранён'); }
                  catch (e) { toast.error(e instanceof ApiError ? e.message : 'Ошибка'); }
                }} className="px-4 py-2.5 rounded-lg bg-[#2D6BE4] text-white" style={{ fontSize: '13px', fontWeight: 600 }}>Сохранить</button>
              </div>
            </div>
            <div className="pt-5 border-t border-[#E5E7EB]">
              <h3 className="text-[#111827] mb-2" style={{ fontSize: '15px', fontWeight: 600 }}>Двухфакторная аутентификация</h3>
              <p className="text-[#6B7280] mb-3" style={{ fontSize: '13px' }}>Дополнительный уровень защиты при входе</p>
              <button onClick={() => toast.info('2FA будет доступна в следующем обновлении')} className="px-4 py-2.5 rounded-lg border border-[#2D6BE4] text-[#2D6BE4]" style={{ fontSize: '14px', fontWeight: 500 }}>Включить 2FA</button>
            </div>
            <div className="pt-5 border-t border-[#E5E7EB]">
              <h3 className="text-[#111827] mb-2" style={{ fontSize: '15px', fontWeight: 600 }}>Доступ сотрудников</h3>
              <p className="text-[#6B7280] mb-3" style={{ fontSize: '13px' }}>Управление правами доступа для ролей</p>
              <div className="space-y-2">
                {[
                  { role: 'Владелец', perms: 'Полный доступ ко всем модулям' },
                  { role: 'Администратор', perms: 'Шахматка, Клиенты, Зарплаты (свои)' },
                  { role: 'Мастер', perms: 'Только свои записи и зарплата' },
                ].map(r => (
                  <div key={r.role} className="flex items-center justify-between p-3 rounded-lg bg-[#F9FAFB]">
                    <div>
                      <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{r.role}</p>
                      <p className="text-[#6B7280]" style={{ fontSize: '12px' }}>{r.perms}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
