// Экран подтверждения записи + добавление в календарь (Этапы 1, 5).
import { Check, User, Calendar } from 'lucide-react';
import { formatPrice } from '../../../lib/mock-data';
import { googleCalendarUrl, downloadIcs } from '../../../lib/calendar';
import { addMinutes, formatDateLongRu } from '../lib/format';
import { totalDuration } from '../lib/selection';
import type { BookingDraft, WidgetInfo, WidgetService } from '../types';

interface Props {
  info: WidgetInfo;
  draft: BookingDraft;
  services: WidgetService[];
  price: number;
  code: string;
  accentColor: string;
  onCabinet: () => void;
}

export function ConfirmationScreen({ info, draft, services, price, code, accentColor, onCabinet }: Props) {
  const serviceNames = services.map((s) => s.name).join(', ');
  const durationMin = totalDuration(services);
  const calEvent = draft.slot && services.length
    ? {
        title: `${serviceNames} — ${info.name}`,
        start: draft.slot.startAt,
        durationMin,
        location: info.address,
        description: `Код записи: ${code}\nСтоимость: ${formatPrice(price)}`,
      }
    : null;
  const endTime = draft.slot && services.length ? addMinutes(draft.slot.time, durationMin) : '';

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="flex-1 max-w-[480px] w-full mx-auto px-4 py-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: '#ECFDF5' }}>
          <Check className="w-8 h-8 text-[#059669]" />
        </div>
        <h2 className="text-[#111827]" style={{ fontSize: '24px', fontWeight: 700 }}>Вы записаны!</h2>
        <p className="text-[#6B7280] mt-2 mb-6" style={{ fontSize: '14px' }}>
          Код записи: <span style={{ fontWeight: 700 }}>{code}</span>
        </p>

        <div className="bg-[#F9FAFB] rounded-xl p-5 text-left space-y-3 mb-6">
          <Row label={services.length > 1 ? 'Услуги' : 'Услуга'} value={serviceNames || '—'} />
          {draft.date && draft.slot && <Row label="Дата" value={formatDateLongRu(draft.date)} />}
          {draft.slot && <Row label="Время" value={`${draft.slot.time} — ${endTime}`} />}
          <Row label="Стоимость" value={formatPrice(price)} bold />
          {info.address && <Row label="Адрес" value={info.address} />}
        </div>

        {calEvent && (
          <div className="mb-4">
            <p className="text-[#6B7280] mb-2.5" style={{ fontSize: '13px' }}>Добавить в календарь</p>
            <div className="grid grid-cols-2 gap-2">
              <a href={googleCalendarUrl(calEvent)} target="_blank" rel="noopener noreferrer"
                className="py-3 rounded-lg border border-[#E5E7EB] text-[#111827] flex items-center justify-center gap-2 hover:border-[#2D6BE4] transition-colors"
                style={{ fontSize: '13px', fontWeight: 600 }}>
                <Calendar className="w-4 h-4" /> Google
              </a>
              <button onClick={() => downloadIcs(calEvent, `${code}@saba`, `saba-${code}.ics`)}
                className="py-3 rounded-lg border border-[#E5E7EB] text-[#111827] flex items-center justify-center gap-2 hover:border-[#2D6BE4] transition-colors"
                style={{ fontSize: '13px', fontWeight: 600 }}>
                <Calendar className="w-4 h-4" /> Apple / iCal
              </button>
            </div>
          </div>
        )}

        <button onClick={onCabinet}
          className="w-full py-3 rounded-lg text-white flex items-center justify-center gap-2"
          style={{ fontSize: '14px', fontWeight: 600, backgroundColor: accentColor }}>
          <User className="w-4 h-4" /> Личный кабинет
        </button>
        <p className="text-[#9CA3AF] mt-3" style={{ fontSize: '12px' }}>Управляйте записями в личном кабинете</p>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#6B7280]" style={{ fontSize: '14px' }}>{label}</span>
      <span className="text-[#111827]" style={{ fontSize: '14px', fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}
