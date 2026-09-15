// Экран выбора услуг — категории + поиск + мультивыбор (Этапы 1, 5).
import { useMemo, useState } from 'react';
import { Search, Check } from 'lucide-react';
import { formatPrice } from '../../../lib/mock-data';
import { formatServicePrice } from '../lib/pricing';
import { formatDuration, selectedServices, servicesWord, totalDuration, totalPrice } from '../lib/selection';
import type { BookingDraft, WidgetInfo, WidgetService } from '../types';
import { usesCarSize } from '../types';
import type { DraftAction } from '../useBookingDraft';

interface Props {
  info: WidgetInfo;
  draft: BookingDraft;
  dispatch: (a: DraftAction) => void;
  accentColor: string;
  onProceed: () => void;
}

const UNCATEGORIZED = 'Услуги';

export function ServicesScreen({ info, draft, dispatch, accentColor, onProceed }: Props) {
  const carwash = usesCarSize(info.businessType);
  const [tab, setTab] = useState('Все');
  const [query, setQuery] = useState('');

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const s of info.services) {
      const c = s.category || UNCATEGORIZED;
      if (!seen.includes(c)) seen.push(c);
    }
    return seen;
  }, [info.services]);

  const priceLabel = (s: WidgetService) => formatServicePrice(s, draft.specialistId, draft.carSize, info.employeePrices ?? []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return info.services.filter((s) => {
      const c = s.category || UNCATEGORIZED;
      if (tab !== 'Все' && c !== tab) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [info.services, tab, query, draft.carSize]);

  const grouped = useMemo(() => {
    const map = new Map<string, WidgetService[]>();
    for (const s of visible) {
      const c = s.category || UNCATEGORIZED;
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(s);
    }
    return [...map.entries()];
  }, [visible]);

  const selectedSvcs = selectedServices(info, draft);

  return (
    <div className="pb-24">
      <h2 className="text-[#111827] mb-4" style={{ fontSize: '22px', fontWeight: 700 }}>Выберите услуги</h2>

      {carwash && info.carSizes && info.carSizes.length > 0 && (
        <div className="mb-4">
          <p className="text-[#6B7280] mb-2" style={{ fontSize: '12px', fontWeight: 500 }}>Тип авто</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {info.carSizes.map((cs) => (
              <button key={cs.key} onClick={() => dispatch({ type: 'setCarSize', carSize: cs.key })}
                className={`shrink-0 px-3.5 py-2 rounded-full border text-[#111827] transition-colors ${draft.carSize === cs.key ? 'border-[#2D6BE4] bg-[#EBF0F9]' : 'border-[#E5E7EB]'}`}
                style={{ fontSize: '13px', fontWeight: 500 }}>
                {cs.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-4 px-4">
          {['Все', ...categories].map((c) => (
            <button key={c} onClick={() => setTab(c)}
              className={`shrink-0 px-3.5 py-2 rounded-full transition-colors ${tab === c ? 'text-white' : 'bg-[#F3F4F6] text-[#6B7280]'}`}
              style={{ fontSize: '13px', fontWeight: 500, ...(tab === c ? { backgroundColor: accentColor } : {}) }}>
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти"
          className="w-full pl-9 pr-4 py-3 rounded-lg border border-[#E5E7EB] text-[#111827] focus:border-[#2D6BE4] focus:outline-none"
          style={{ fontSize: '15px' }} />
      </div>

      {visible.length === 0 ? (
        <p className="text-center text-[#9CA3AF] py-10" style={{ fontSize: '14px' }}>Ничего не найдено</p>
      ) : (
        grouped.map(([cat, items]) => (
          <div key={cat} className="mb-4">
            {(categories.length > 1 || cat !== UNCATEGORIZED) && (
              <h3 className="text-[#111827] mb-2" style={{ fontSize: '16px', fontWeight: 700 }}>{cat}</h3>
            )}
            <div className="space-y-2">
              {items.map((s) => {
                const isSel = draft.serviceIds.includes(s.id);
                return (
                  <button key={s.id} onClick={() => dispatch({ type: 'toggleService', serviceId: s.id })}
                    className={`w-full p-4 rounded-xl border text-left flex items-start justify-between gap-3 transition-colors ${isSel ? 'border-[#2D6BE4] bg-[#EBF0F9]' : 'border-[#E5E7EB] hover:border-[#2D6BE4]'}`}>
                    <div className="min-w-0">
                      <p className="text-[#111827]" style={{ fontSize: '15px', fontWeight: 600 }}>{s.name}</p>
                      <p className="text-[#6B7280] mt-0.5" style={{ fontSize: '12px' }}>{formatDuration(s.durationMin)}</p>
                      <p className="text-[#111827] mt-1" style={{ fontSize: '15px', fontWeight: 700 }}>{priceLabel(s)}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${isSel ? 'border-[#2D6BE4]' : 'border-[#D1D5DB]'}`}
                      style={isSel ? { backgroundColor: accentColor } : {}}>
                      {isSel && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Sticky bottom bar */}
      {selectedSvcs.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-4 py-3">
          <div className="max-w-[480px] mx-auto flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[#6B7280] truncate" style={{ fontSize: '12px' }}>
                {selectedSvcs.length} {servicesWord(selectedSvcs.length)} · {formatDuration(totalDuration(selectedSvcs))}
              </p>
              <p className="text-[#111827]" style={{ fontSize: '15px', fontWeight: 700 }}>
                {formatPrice(totalPrice(selectedSvcs, draft.specialistId, draft.carSize, info.employeePrices ?? []))}
              </p>
            </div>
            <button onClick={onProceed}
              className="px-6 py-3 rounded-lg text-white shrink-0" style={{ fontSize: '14px', fontWeight: 600, backgroundColor: accentColor }}>
              Далее
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
