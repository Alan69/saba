// Экран «Детали записи» — обзор с правками + контактная форма (Этапы 1, 5).
import type { ReactNode } from 'react';
import { Pencil, Loader2, User, Calendar, Check } from 'lucide-react';
import { formatPrice } from '../../../lib/mock-data';
import { addMinutes, formatDateLongRu } from '../lib/format';
import { isValidEmail, isValidPhone } from '../lib/validation';
import { effectivePrice } from '../lib/pricing';
import { totalDuration } from '../lib/selection';
import { REMINDER_OPTIONS, type BookingDraft, type Screen, type WidgetInfo, type WidgetService } from '../types';
import type { DraftAction } from '../useBookingDraft';

interface Props {
  info: WidgetInfo;
  draft: BookingDraft;
  dispatch: (a: DraftAction) => void;
  services: WidgetService[];
  price: number;
  specialistName: string;
  accentColor: string;
  booking: boolean;
  onEdit: (screen: Screen) => void;
  onBook: () => void;
}

export function DetailsScreen({ info, draft, dispatch, services, price, specialistName, accentColor, booking, onEdit, onBook }: Props) {
  const c = draft.contact;
  const emailOk = !c.email.trim() || isValidEmail(c.email.trim());
  const formValid = isValidPhone(c.phone) && emailOk && draft.consent && services.length > 0 && Boolean(draft.slot);
  const endTime = draft.slot && services.length ? addMinutes(draft.slot.time, totalDuration(services)) : '';

  return (
    <div className="pb-4">
      <h2 className="text-[#111827] mb-4" style={{ fontSize: '22px', fontWeight: 700 }}>Детали записи</h2>

      <div className="bg-[#F9FAFB] rounded-xl p-4 mb-5 divide-y divide-[#E5E7EB]">
        {/* Specialist */}
        <div className="flex items-center gap-3 pb-3">
          <div className="w-9 h-9 rounded-full bg-[#EBF0F9] flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-[#1B4F8A]" />
          </div>
          <p className="text-[#111827] flex-1" style={{ fontSize: '14px', fontWeight: 500 }}>{specialistName}</p>
          <button onClick={() => onEdit('specialist')} className="p-1.5 text-[#9CA3AF] hover:text-[#2D6BE4]"><Pencil className="w-4 h-4" /></button>
        </div>

        {/* Date & time */}
        <div className="flex items-center gap-3 py-3">
          <div className="w-9 h-9 rounded-full bg-[#EBF0F9] flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-[#1B4F8A]" />
          </div>
          <div className="flex-1 min-w-0">
            {draft.date && draft.slot ? (
              <>
                <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{formatDateLongRu(draft.date)}</p>
                <p className="text-[#6B7280]" style={{ fontSize: '13px' }}>{draft.slot.time} — {endTime}</p>
              </>
            ) : (
              <p className="text-[#9CA3AF]" style={{ fontSize: '14px' }}>Время не выбрано</p>
            )}
          </div>
          <button onClick={() => onEdit('datetime')} className="p-1.5 text-[#9CA3AF] hover:text-[#2D6BE4]"><Pencil className="w-4 h-4" /></button>
        </div>

        {/* Services */}
        <div className="flex items-start gap-3 pt-3">
          <div className="flex-1 min-w-0">
            <p className="text-[#6B7280] mb-1" style={{ fontSize: '12px', fontWeight: 500 }}>Услуги</p>
            {services.length ? (
              <div className="space-y-1">
                {services.map((s) => (
                  <div key={s.id} className="flex justify-between gap-2">
                    <span className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{s.name}</span>
                    <span className="text-[#111827] shrink-0" style={{ fontSize: '14px', fontWeight: 600 }}>
                      {formatPrice(effectivePrice(s, draft.specialistId, draft.carSize, info.employeePrices ?? []))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#9CA3AF]" style={{ fontSize: '14px' }}>Услуги не выбраны</p>
            )}
          </div>
          <button onClick={() => onEdit('services')} className="p-1.5 text-[#9CA3AF] hover:text-[#2D6BE4]"><Pencil className="w-4 h-4" /></button>
        </div>
      </div>

      <h3 className="text-[#111827] mb-3" style={{ fontSize: '18px', fontWeight: 700 }}>Ваши данные</h3>
      <div className="space-y-3">
        <Field label="Имя">
          <input value={c.name} onChange={(e) => dispatch({ type: 'setContact', field: 'name', value: e.target.value })}
            placeholder="Как вас зовут?" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Телефон *">
          <input value={c.phone} onChange={(e) => dispatch({ type: 'setContact', field: 'phone', value: e.target.value })}
            placeholder="+7 (___) ___-__-__" type="tel" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="E-mail">
          <input value={c.email} onChange={(e) => dispatch({ type: 'setContact', field: 'email', value: e.target.value })}
            placeholder="you@example.com" type="email"
            className={`${inputCls} ${emailOk ? 'border-[#E5E7EB] focus:border-[#2D6BE4]' : 'border-[#DC2626]'}`} style={inputStyle} />
        </Field>
        <Field label="Комментарий">
          <textarea value={c.comment} onChange={(e) => dispatch({ type: 'setContact', field: 'comment', value: e.target.value })}
            placeholder="Комментарий к записи" rows={2}
            className={`${inputCls} border-[#E5E7EB] focus:border-[#2D6BE4] resize-none`} style={inputStyle} />
        </Field>
        <Field label="Напоминание">
          <select value={draft.reminderMinutes} onChange={(e) => dispatch({ type: 'setReminder', minutes: Number(e.target.value) })}
            className={`${inputCls} border-[#E5E7EB] focus:border-[#2D6BE4]`} style={inputStyle}>
            {REMINDER_OPTIONS.map((o) => <option key={o.minutes} value={o.minutes}>{o.label}</option>)}
          </select>
        </Field>
      </div>

      {/* Consent */}
      <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
        <button type="button" onClick={() => dispatch({ type: 'setConsent', consent: !draft.consent })}
          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${draft.consent ? 'border-[#2D6BE4]' : 'border-[#D1D5DB]'}`}
          style={draft.consent ? { backgroundColor: accentColor } : {}}>
          {draft.consent && <Check className="w-3.5 h-3.5 text-white" />}
        </button>
        <span className="text-[#6B7280]" style={{ fontSize: '12px', lineHeight: '1.5' }}>
          Я соглашаюсь на обработку персональных данных
          {info.privacyUrl && <> и принимаю <a href={info.privacyUrl} target="_blank" rel="noopener noreferrer" className="text-[#2D6BE4] underline">Политику конфиденциальности</a></>}
          {info.termsUrl && <> и <a href={info.termsUrl} target="_blank" rel="noopener noreferrer" className="text-[#2D6BE4] underline">Пользовательское соглашение</a></>}
        </span>
      </label>

      <div className="flex justify-between items-center mt-5 mb-3">
        <span className="text-[#111827]" style={{ fontSize: '16px', fontWeight: 600 }}>Итого</span>
        <span className="text-[#111827]" style={{ fontSize: '18px', fontWeight: 700 }}>{formatPrice(price)}</span>
      </div>

      <button onClick={onBook} disabled={!formValid || booking}
        className={`w-full py-3.5 rounded-lg text-white flex items-center justify-center gap-2 ${formValid && !booking ? '' : 'opacity-50 cursor-not-allowed'}`}
        style={{ fontSize: '15px', fontWeight: 600, backgroundColor: accentColor }}>
        {booking && <Loader2 className="w-4 h-4 animate-spin" />}
        Записаться
      </button>
    </div>
  );
}

const inputCls = 'w-full px-4 py-3 rounded-lg border text-[#111827] focus:outline-none';
const inputStyle = { fontSize: '15px' } as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}
