import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Check, Plus, Trash2, Car, Wrench, Building2, ChevronRight, Copy, PartyPopper, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useStore } from '../../lib/store';
import { apiPatch, apiPost, ApiError } from '../../lib/api';

const BUSINESS_TYPES = [
  { id: 'carwash', label: 'Автомойка', desc: 'Мойка, полировка, химчистка', icon: Car },
  { id: 'detailing', label: 'Детейлинг', desc: 'Защитные покрытия, керамика', icon: Wrench },
  { id: 'sto', label: 'СТО', desc: 'Ремонт и обслуживание авто', icon: Building2 },
];

const DAYS = [
  { key: 'mon', label: 'Пн' }, { key: 'tue', label: 'Вт' }, { key: 'wed', label: 'Ср' },
  { key: 'thu', label: 'Чт' }, { key: 'fri', label: 'Пт' }, { key: 'sat', label: 'Сб' }, { key: 'sun', label: 'Вс' },
];

export function OnboardingPage() {
  const { company, refreshCompany } = useAuth();
  const { reload } = useStore();
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState('');
  const [companyName, setCompanyName] = useState(company?.name ?? '');
  const [companyPhone, setCompanyPhone] = useState(company?.phone ?? '');
  const [companyAddress, setCompanyAddress] = useState(company?.address ?? '');
  const [timezone, setTimezone] = useState(company?.timezone ?? 'Asia/Almaty');
  const [submitting, setSubmitting] = useState(false);
  const [boxes, setBoxes] = useState([{ name: 'Бокс 1', color: '#3B82F6' }]);
  const [services, setServices] = useState([
    { name: 'Мойка кузова', duration: '30', price: '3000' },
    { name: 'Химчистка салона', duration: '120', price: '15000' },
    { name: 'Мойка двигателя', duration: '45', price: '5000' },
    { name: 'Полировка', duration: '90', price: '12000' },
  ]);
  const [employees, setEmployees] = useState<{ name: string; role: string; salaryValue: string; phone: string; pin: string }[]>([]);
  const [schedule, setSchedule] = useState(
    DAYS.map((d, i) => ({ ...d, active: i < 6, start: '09:00', end: '20:00' }))
  );
  const navigate = useNavigate();

  const totalSteps = 7;

  const canProceed = () => {
    if (step === 1) return !!businessType;
    if (step === 2) return !!companyName.trim();
    if (step === 3) return boxes.length > 0 && boxes.every(b => b.name.trim());
    if (step === 4) return services.length > 0 && services.every(s => s.name.trim() && s.price);
    return true;
  };

  /** Финал визарда: сохраняем всё в API одним заходом */
  const finishSetup = async () => {
    setSubmitting(true);
    try {
      const workingHours = Object.fromEntries(
        schedule.map(d => [d.key, { enabled: d.active, start: d.start, end: d.end }]),
      );
      await apiPatch('/company', {
        name: companyName.trim() || undefined,
        businessType: businessType || undefined,
        phone: companyPhone || undefined,
        address: companyAddress || undefined,
        timezone,
        workingHours,
        wizardDone: true,
        wizardStep: 7,
      });
      for (const box of boxes) {
        await apiPost('/boxes', { name: box.name.trim(), color: box.color }).catch((e) => {
          if (!(e instanceof ApiError && e.status === 403)) throw e;
          toast.warning(e.message);
        });
      }
      for (const svc of services) {
        const base = Number(svc.price) || 0;
        await apiPost('/services', {
          name: svc.name.trim(),
          durationMin: Number(svc.duration) || 30,
          price: base,
        });
      }
      for (const emp of employees) {
        if (!emp.name.trim()) continue;
        const created = await apiPost('/employees', {
          name: emp.name.trim(),
          role: emp.role === 'admin' ? 'admin' : 'master',
          phone: emp.phone?.trim() || undefined,
          pin: emp.pin?.trim() || undefined,
        });
        const value = Number(emp.salaryValue) || 0;
        if (value > 0) {
          await apiPost('/salary/rules', {
            employeeId: created.id,
            type: 'percent',
            config: { percent: value },
          }).catch(() => { /* Light-план */ });
        }
      }
      await refreshCompany();
      await reload();
      setStep(7);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Не удалось сохранить настройки');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#0D1F3C] flex items-center justify-center">
            <span className="text-white" style={{ fontSize: '12px', fontWeight: 700 }}>S</span>
          </div>
          <span className="text-[#0D1F3C]" style={{ fontSize: '16px', fontWeight: 700 }}>saba</span>
        </div>
        <span className="text-[#6B7280]" style={{ fontSize: '13px' }}>Шаг {step} из {totalSteps}</span>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-[#E5E7EB]">
        <div className="h-full bg-[#2D6BE4] transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[540px] mx-auto px-4 py-8">

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-[#0D1F3C]" style={{ fontSize: '28px', fontWeight: 700 }}>Добро пожаловать в Saba</h1>
                <p className="text-[#6B7280] mt-2" style={{ fontSize: '16px' }}>Выберите тип вашего бизнеса</p>
              </div>
              <div className="space-y-3">
                {BUSINESS_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setBusinessType(type.id)}
                    className={`w-full p-5 rounded-xl border-2 flex items-center gap-4 text-left transition-colors ${
                      businessType === type.id
                        ? 'border-[#2D6BE4] bg-[#EBF0F9]'
                        : 'border-[#E5E7EB] bg-white hover:border-[#2D6BE4]'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      businessType === type.id ? 'bg-[#2D6BE4]' : 'bg-[#F3F4F6]'
                    }`}>
                      <type.icon className={`w-6 h-6 ${businessType === type.id ? 'text-white' : 'text-[#6B7280]'}`} />
                    </div>
                    <div>
                      <p className="text-[#111827]" style={{ fontSize: '16px', fontWeight: 600 }}>{type.label}</p>
                      <p className="text-[#6B7280]" style={{ fontSize: '14px' }}>{type.desc}</p>
                    </div>
                    {businessType === type.id && (
                      <div className="ml-auto w-6 h-6 rounded-full bg-[#2D6BE4] flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Company Profile */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-[#0D1F3C]" style={{ fontSize: '24px', fontWeight: 700 }}>Профиль компании</h2>
              <div>
                <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Название компании *</label>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="AutoBliss Almaty" className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:border-[#2D6BE4] focus:outline-none" style={{ fontSize: '14px' }} />
              </div>
              <div>
                <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Телефон</label>
                <input value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder="+7 (___) ___-__-__" className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
              </div>
              <div>
                <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Адрес</label>
                <input value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} placeholder="ул. Тимирязева 42, Алматы" className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
              </div>
              <div>
                <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Часовой пояс</label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none" style={{ fontSize: '14px' }}>
                  <option>Asia/Almaty</option>
                  <option>Asia/Aqtau</option>
                  <option>Asia/Aqtobe</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Boxes */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[#0D1F3C]" style={{ fontSize: '24px', fontWeight: 700 }}>Боксы / Посты</h2>
                <p className="text-[#6B7280] mt-1" style={{ fontSize: '14px' }}>Добавьте места обслуживания (минимум 1)</p>
              </div>
              <div className="space-y-2">
                {boxes.map((box, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white rounded-lg border border-[#E5E7EB] p-3">
                    <div className="w-3 h-8 rounded-full cursor-grab" style={{ backgroundColor: box.color }} />
                    <input
                      value={box.name}
                      onChange={e => { const newBoxes = [...boxes]; newBoxes[i].name = e.target.value; setBoxes(newBoxes); }}
                      className="flex-1 px-3 py-2 rounded-md border border-[#E5E7EB] text-[#111827] focus:outline-none"
                      style={{ fontSize: '14px' }}
                    />
                    {boxes.length > 1 && (
                      <button onClick={() => setBoxes(boxes.filter((_, j) => j !== i))} className="p-2 text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {boxes.length < 20 && (
                <button
                  onClick={() => setBoxes([...boxes, { name: `Бокс ${boxes.length + 1}`, color: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][boxes.length % 5] }])}
                  className="flex items-center gap-2 text-[#2D6BE4] hover:text-[#1B4F8A]"
                  style={{ fontSize: '14px', fontWeight: 500 }}
                >
                  <Plus className="w-4 h-4" /> Добавить бокс
                </button>
              )}
            </div>
          )}

          {/* Step 4: Services */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[#0D1F3C]" style={{ fontSize: '24px', fontWeight: 700 }}>Услуги и цены</h2>
                <p className="text-[#6B7280] mt-1" style={{ fontSize: '14px' }}>Настройте прайс-лист</p>
              </div>
              <div className="space-y-3">
                {services.map((svc, i) => (
                  <div key={i} className="bg-white rounded-lg border border-[#E5E7EB] p-3 space-y-2">
                    <div>
                      <label className="text-[#6B7280] block mb-1" style={{ fontSize: '11px', fontWeight: 500 }}>Название услуги</label>
                      <input
                        value={svc.name}
                        onChange={e => { const s = [...services]; s[i].name = e.target.value; setServices(s); }}
                        className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-[#111827] focus:outline-none"
                        style={{ fontSize: '14px' }}
                        placeholder="Напр. Мойка кузова"
                      />
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-[#6B7280] block mb-1" style={{ fontSize: '11px', fontWeight: 500 }}>Длительность услуги</label>
                        <select
                          value={svc.duration}
                          onChange={e => { const s = [...services]; s[i].duration = e.target.value; setServices(s); }}
                          className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-[#111827]"
                          style={{ fontSize: '14px' }}
                        >
                          {[30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} мин</option>)}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[#6B7280] block mb-1" style={{ fontSize: '11px', fontWeight: 500 }}>Цена</label>
                        <div className="relative">
                          <input
                            value={svc.price}
                            onChange={e => { const s = [...services]; s[i].price = e.target.value; setServices(s); }}
                            inputMode="numeric"
                            className="w-full px-3 py-2 pr-8 rounded-md border border-[#E5E7EB] text-[#111827]"
                            style={{ fontSize: '14px' }}
                            placeholder="0"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" style={{ fontSize: '14px' }}>₸</span>
                        </div>
                      </div>
                      <button onClick={() => setServices(services.filter((_, j) => j !== i))} className="p-2 mb-0.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setServices([...services, { name: '', duration: '30', price: '' }])}
                className="flex items-center gap-2 text-[#2D6BE4]"
                style={{ fontSize: '14px', fontWeight: 500 }}
              >
                <Plus className="w-4 h-4" /> Добавить услугу
              </button>
            </div>
          )}

          {/* Step 5: Employees */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[#0D1F3C]" style={{ fontSize: '24px', fontWeight: 700 }}>Сотрудники</h2>
                <p className="text-[#6B7280] mt-1" style={{ fontSize: '14px' }}>Добавьте мастеров (можно пропустить)</p>
              </div>
              <div className="space-y-3">
                {employees.map((emp, i) => (
                  <div key={i} className="bg-white rounded-lg border border-[#E5E7EB] p-3 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <label className="text-[#6B7280] block mb-1" style={{ fontSize: '11px', fontWeight: 500 }}>Имя сотрудника</label>
                        <input
                          value={emp.name}
                          onChange={e => { const em = [...employees]; em[i].name = e.target.value; setEmployees(em); }}
                          placeholder="Напр. Асхат М."
                          className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-[#111827] focus:outline-none"
                          style={{ fontSize: '14px' }}
                        />
                      </div>
                      <button onClick={() => setEmployees(employees.filter((_, j) => j !== i))} className="p-2 mt-5 text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[#6B7280] block mb-1" style={{ fontSize: '11px', fontWeight: 500 }}>Роль</label>
                        <select
                          value={emp.role}
                          onChange={e => { const em = [...employees]; em[i].role = e.target.value; setEmployees(em); }}
                          className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-[#111827]"
                          style={{ fontSize: '14px' }}
                        >
                          <option value="master">Мастер</option>
                          <option value="admin">Администратор</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[#6B7280] block mb-1" style={{ fontSize: '11px', fontWeight: 500 }}>Зарплата, % от услуги</label>
                        <div className="relative">
                          <input
                            value={emp.salaryValue}
                            onChange={e => { const em = [...employees]; em[i].salaryValue = e.target.value.replace(/\D/g, ''); setEmployees(em); }}
                            inputMode="numeric"
                            placeholder="35"
                            className="w-full px-3 py-2 pr-7 rounded-md border border-[#E5E7EB] text-[#111827]"
                            style={{ fontSize: '14px' }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" style={{ fontSize: '14px' }}>%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[#6B7280] block mb-1" style={{ fontSize: '11px', fontWeight: 500 }}>Телефон</label>
                        <input
                          value={emp.phone}
                          onChange={e => { const em = [...employees]; em[i].phone = e.target.value; setEmployees(em); }}
                          placeholder="+7 700 000 00 00"
                          type="tel"
                          className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-[#111827] focus:outline-none"
                          style={{ fontSize: '14px' }}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[#6B7280] block mb-1" style={{ fontSize: '11px', fontWeight: 500 }}>PIN для входа</label>
                        <input
                          value={emp.pin}
                          onChange={e => { const em = [...employees]; em[i].pin = e.target.value.replace(/\D/g, '').slice(0, 6); setEmployees(em); }}
                          placeholder="4 цифры"
                          inputMode="numeric"
                          className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-[#111827] focus:outline-none"
                          style={{ fontSize: '14px' }}
                        />
                      </div>
                    </div>
                    <p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>Мастер входит в систему по PIN — только смена статуса своих записей</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setEmployees([...employees, { name: '', role: 'master', salaryValue: '35', phone: '', pin: '' }])}
                className="flex items-center gap-2 text-[#2D6BE4]"
                style={{ fontSize: '14px', fontWeight: 500 }}
              >
                <Plus className="w-4 h-4" /> Добавить сотрудника
              </button>
            </div>
          )}

          {/* Step 6: Working Hours */}
          {step === 6 && (
            <div className="space-y-5">
              <h2 className="text-[#0D1F3C]" style={{ fontSize: '24px', fontWeight: 700 }}>Режим работы</h2>
              <div className="space-y-2">
                {schedule.map((day, i) => (
                  <div key={day.key} className="flex items-center gap-3 bg-white rounded-lg border border-[#E5E7EB] p-3">
                    <span className="w-8 text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{day.label}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={day.active}
                        onChange={() => { const s = [...schedule]; s[i].active = !s[i].active; setSchedule(s); }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[#E5E7EB] rounded-full peer peer-checked:bg-[#2D6BE4]" />
                    </label>
                    {day.active ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={day.start}
                          onChange={e => { const s = [...schedule]; s[i].start = e.target.value; setSchedule(s); }}
                          className="px-2 py-1.5 rounded-md border border-[#E5E7EB] text-[#111827]"
                          style={{ fontSize: '14px' }}
                        />
                        <span className="text-[#9CA3AF]">—</span>
                        <input
                          type="time"
                          value={day.end}
                          onChange={e => { const s = [...schedule]; s[i].end = e.target.value; setSchedule(s); }}
                          className="px-2 py-1.5 rounded-md border border-[#E5E7EB] text-[#111827]"
                          style={{ fontSize: '14px' }}
                        />
                      </div>
                    ) : (
                      <span className="text-[#9CA3AF]" style={{ fontSize: '14px' }}>Выходной</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 7: Done */}
          {step === 7 && (
            <div className="text-center py-8 space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-[#ECFDF5] flex items-center justify-center">
                <PartyPopper className="w-10 h-10 text-[#059669]" />
              </div>
              <div>
                <h2 className="text-[#0D1F3C]" style={{ fontSize: '28px', fontWeight: 700 }}>Всё готово!</h2>
                <p className="text-[#6B7280] mt-2" style={{ fontSize: '16px' }}>Ваш бизнес настроен и готов к работе</p>
              </div>
              <div className="bg-[#F9FAFB] rounded-xl p-5 text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]" style={{ fontSize: '14px' }}>Боксов</span>
                  <span className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 600 }}>{boxes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]" style={{ fontSize: '14px' }}>Услуг</span>
                  <span className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 600 }}>{services.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]" style={{ fontSize: '14px' }}>Сотрудников</span>
                  <span className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 600 }}>{employees.length}</span>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                <p className="text-[#6B7280] mb-2" style={{ fontSize: '12px', fontWeight: 500 }}>Ссылка на виджет записи</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-[#F9FAFB] rounded-lg text-[#1B4F8A]" style={{ fontSize: '14px' }}>{`${window.location.host}/booking/${company?.slug ?? ''}`}</code>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(`${window.location.origin}/booking/${company?.slug ?? ''}`);
                      toast.success('Ссылка скопирована');
                    }}
                    className="p-2 rounded-lg hover:bg-[#F9FAFB]">
                    <Copy className="w-4 h-4 text-[#6B7280]" />
                  </button>
                </div>
              </div>
              <div className="space-y-3 pt-4">
                <button
                  onClick={() => navigate('/schedule')}
                  className="w-full py-3.5 rounded-lg bg-[#2D6BE4] text-white"
                  style={{ fontSize: '14px', fontWeight: 600 }}
                >
                  Открыть шахматку
                </button>
                <button
                  onClick={() => navigate(`/booking/${company?.slug ?? ''}`)}
                  className="w-full py-3.5 rounded-lg border border-[#E5E7EB] text-[#6B7280]"
                  style={{ fontSize: '14px', fontWeight: 500 }}
                >
                  Посмотреть виджет записи
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      {step < 7 && (
        <div className="bg-white border-t border-[#E5E7EB] px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            className={`px-4 py-2.5 rounded-lg ${step === 1 ? 'invisible' : 'text-[#6B7280] hover:text-[#111827]'}`}
            style={{ fontSize: '14px', fontWeight: 500 }}
          >
            Назад
          </button>
          <div className="flex items-center gap-2">
            {step === 5 && (
              <button
                onClick={() => setStep(6)}
                className="px-4 py-2.5 rounded-lg text-[#6B7280]"
                style={{ fontSize: '14px' }}
              >
                Пропустить
              </button>
            )}
            <button
              onClick={() => (step === 6 ? void finishSetup() : setStep(Math.min(7, step + 1)))}
              disabled={!canProceed() || submitting}
              className={`px-6 py-2.5 rounded-lg text-white flex items-center gap-2 ${
                canProceed() && !submitting ? 'bg-[#2D6BE4] hover:bg-[#1B4F8A]' : 'bg-[#9CA3AF] cursor-not-allowed'
              }`}
              style={{ fontSize: '14px', fontWeight: 600 }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {step === 6 ? 'Завершить' : 'Далее'} {!submitting && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
