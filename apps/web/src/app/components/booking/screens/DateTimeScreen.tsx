// Экран выбора даты и времени — календарь по месяцам + слоты группами (Этап 1).
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { apiPublic } from '../../../lib/api';
import type { BookingDraft, Slot, WidgetInfo } from '../types';
import type { DraftAction } from '../useBookingDraft';
import { groupSlots, isDayDisabled, monthGrid, sameISODate, toISODate } from '../lib/slots';
import { formatMonthRu } from '../lib/format';

interface Props {
  slug: string;
  info: WidgetInfo;
  draft: BookingDraft;
  dispatch: (a: DraftAction) => void;
  accentColor: string;
  onPickService: () => void;
  onProceed: () => void;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const GROUP_LABELS: Record<'morning' | 'day' | 'evening', string> = { morning: 'Утро', day: 'День', evening: 'Вечер' };

export function DateTimeScreen({ slug, info, draft, dispatch, accentColor, onPickService, onProceed }: Props) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!draft.date || !draft.serviceIds.length) {
      setSlots([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const empParam = draft.specialistId !== 'any' ? `&employeeId=${draft.specialistId}` : '';
    apiPublic(`/widget/${slug}/slots?date=${draft.date}&serviceIds=${draft.serviceIds.join(',')}${empParam}`)
      .then((d) => alive && setSlots(d.slots))
      .catch(() => alive && setSlots([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [slug, draft.date, draft.serviceIds, draft.specialistId]);

  const weeks = monthGrid(view.year, view.month);
  const canPrev = view.year > today.getFullYear() || (view.year === today.getFullYear() && view.month > today.getMonth());
  const shiftMonth = (delta: number) => {
    const m = view.month + delta;
    setView({ year: view.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 });
  };
  const groups = groupSlots(slots);

  return (
    <div className="pb-24">
      <h2 className="text-[#111827] mb-4" style={{ fontSize: '22px', fontWeight: 700 }}>Дата и время</h2>

      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#111827]" style={{ fontSize: '15px', fontWeight: 600 }}>{formatMonthRu(view.year, view.month)}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => canPrev && shiftMonth(-1)} disabled={!canPrev}
            className={`p-1.5 rounded-lg ${canPrev ? 'text-[#6B7280] hover:bg-[#F3F4F6]' : 'text-[#D1D5DB] cursor-not-allowed'}`}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[#9CA3AF] py-1" style={{ fontSize: '12px' }}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 mb-5">
        {weeks.flat().map((date, i) => {
          if (!date) return <div key={i} />;
          const disabled = isDayDisabled(date, today, info.workingHours);
          const selected = sameISODate(date, draft.date);
          return (
            <div key={i} className="flex justify-center">
              <button disabled={disabled} onClick={() => dispatch({ type: 'setDate', date: toISODate(date) })}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  selected ? 'text-white' : disabled ? 'text-[#D1D5DB] cursor-not-allowed' : 'text-[#111827] hover:bg-[#F3F4F6]'
                }`}
                style={{ fontSize: '14px', fontWeight: selected ? 700 : 500, ...(selected ? { backgroundColor: accentColor } : {}) }}>
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      {/* Slots */}
      {!draft.serviceIds.length ? (
        <div className="text-center py-8">
          <p className="text-[#6B7280] mb-3" style={{ fontSize: '14px' }}>Выберите услугу, чтобы увидеть свободное время</p>
          <button onClick={onPickService} className="px-5 py-2.5 rounded-lg border border-[#E5E7EB] text-[#111827]" style={{ fontSize: '14px', fontWeight: 600 }}>
            Выбрать услугу
          </button>
        </div>
      ) : !draft.date ? (
        <p className="text-center text-[#9CA3AF] py-8" style={{ fontSize: '14px' }}>Выберите день в календаре</p>
      ) : loading ? (
        <div className="py-8 text-center"><Loader2 className="w-6 h-6 text-[#2D6BE4] animate-spin mx-auto" /></div>
      ) : slots.length === 0 ? (
        <p className="text-center text-[#9CA3AF] py-8" style={{ fontSize: '14px' }}>Нет свободных слотов на этот день</p>
      ) : (
        (['morning', 'day', 'evening'] as const).map((g) =>
          groups[g].length === 0 ? null : (
            <div key={g} className="mb-4">
              <p className="text-[#6B7280] mb-2" style={{ fontSize: '13px', fontWeight: 600 }}>{GROUP_LABELS[g]}</p>
              <div className="grid grid-cols-3 gap-2">
                {groups[g].map((slot) => {
                  const isSel = draft.slot?.startAt === slot.startAt;
                  return (
                    <button key={slot.startAt}
                      onClick={() => dispatch({ type: 'setSlot', slot: { startAt: slot.startAt, boxId: slot.boxIds[0], time: slot.time } })}
                      className={`py-3 rounded-lg text-center transition-colors ${isSel ? 'text-white' : 'bg-[#F9FAFB] border border-[#E5E7EB] text-[#111827] hover:border-[#2D6BE4]'}`}
                      style={{ fontSize: '14px', fontWeight: 500, ...(isSel ? { backgroundColor: accentColor } : {}) }}>
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            </div>
          ),
        )
      )}

      {/* Sticky bottom bar */}
      {draft.slot && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-4 py-3">
          <div className="max-w-[480px] mx-auto">
            <button onClick={onProceed}
              className="w-full py-3.5 rounded-lg text-white" style={{ fontSize: '15px', fontWeight: 600, backgroundColor: accentColor }}>
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
