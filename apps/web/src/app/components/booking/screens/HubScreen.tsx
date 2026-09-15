// Хаб — стартовый экран со свободным порядком (Этапы 1–5).
import { Users, Calendar, ListChecks, ChevronRight } from 'lucide-react';
import { formatPrice } from '../../../lib/mock-data';
import { formatDateRu } from '../lib/format';
import { servicesWord, totalPrice } from '../lib/selection';
import type { BookingDraft, Screen, WidgetInfo, WidgetService } from '../types';

interface Props {
  info: WidgetInfo;
  draft: BookingDraft;
  services: WidgetService[];
  specialistName: string;
  accentColor: string;
  onPick: (screen: Screen) => void;
}

export function HubScreen({ info, draft, services, specialistName, accentColor, onPick }: Props) {
  const dateTimeLabel = draft.date && draft.slot ? `${formatDateRu(draft.date)}, ${draft.slot.time}` : 'Не выбрано';
  const servicesTitle = services.length === 1 ? services[0].name : `${services.length} ${servicesWord(services.length)}`;
  const serviceLabel = services.length
    ? `${servicesTitle} · ${formatPrice(totalPrice(services, draft.specialistId, draft.carSize, info.employeePrices ?? []))}`
    : 'Не выбрано';
  const ready = services.length > 0 && Boolean(draft.slot);

  const rows: { icon: typeof Users; title: string; value: string; onClick: () => void; muted: boolean }[] = [
    { icon: Users, title: 'Выбрать специалиста', value: specialistName, muted: draft.specialistId === 'any',
      onClick: () => onPick('specialist') },
    { icon: Calendar, title: 'Выбрать дату и время', value: dateTimeLabel, muted: !draft.slot,
      onClick: () => onPick('datetime') },
    { icon: ListChecks, title: 'Выбрать услуги', value: serviceLabel, muted: services.length === 0,
      onClick: () => onPick('services') },
  ];

  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <button key={r.title} onClick={r.onClick}
          className="w-full p-4 rounded-xl border border-[#E5E7EB] flex items-center gap-3 text-left hover:border-[#2D6BE4] transition-colors">
          <div className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
            <r.icon className="w-5 h-5 text-[#6B7280]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[#111827]" style={{ fontSize: '15px', fontWeight: 600 }}>{r.title}</p>
            <p className={`truncate ${r.muted ? 'text-[#9CA3AF]' : 'text-[#2D6BE4]'}`} style={{ fontSize: '13px' }}>{r.value}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-[#9CA3AF] shrink-0" />
        </button>
      ))}

      <button onClick={() => ready && onPick('details')} disabled={!ready}
        className={`w-full mt-3 py-3.5 rounded-lg text-white ${ready ? '' : 'opacity-50 cursor-not-allowed'}`}
        style={{ fontSize: '15px', fontWeight: 600, backgroundColor: accentColor }}>
        Продолжить
      </button>
      {!ready && (
        <p className="text-center text-[#9CA3AF]" style={{ fontSize: '12px' }}>
          Выберите услугу и время, чтобы продолжить
        </p>
      )}
    </div>
  );
}
