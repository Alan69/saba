// Экран выбора специалиста — фото, рейтинг, отзывы, цена (Этапы 2–4).
import { useState } from 'react';
import { Users, Star, Info } from 'lucide-react';
import { formatPrice } from '../../../lib/mock-data';
import { selectedServices, totalPrice } from '../lib/selection';
import type { BookingDraft, Specialist, WidgetInfo } from '../types';
import type { DraftAction } from '../useBookingDraft';

interface Props {
  info: WidgetInfo;
  draft: BookingDraft;
  dispatch: (a: DraftAction) => void;
  accentColor: string;
  onProceed: () => void;
}

function reviewsWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'отзыв';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'отзыва';
  return 'отзывов';
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i < full ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-[#E5E7EB] fill-[#E5E7EB]'}`} />
      ))}
    </span>
  );
}

function Radio({ checked, accentColor }: { checked: boolean; accentColor: string }) {
  return (
    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${checked ? '' : 'border-[#D1D5DB]'}`}
      style={checked ? { borderColor: accentColor } : {}}>
      {checked && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />}
    </div>
  );
}

export function SpecialistScreen({ info, draft, dispatch, accentColor, onProceed }: Props) {
  const specialists = info.specialists ?? [];
  const svcs = selectedServices(info, draft);
  const [bioOpen, setBioOpen] = useState<string | null>(null);

  const pick = (id: string) => {
    dispatch({ type: 'setSpecialist', specialistId: id });
    onProceed();
  };

  return (
    <div className="space-y-2.5">
      <h2 className="text-[#111827] mb-4" style={{ fontSize: '22px', fontWeight: 700 }}>Выберите специалиста</h2>

      <button onClick={() => pick('any')}
        className={`w-full p-4 rounded-xl border flex items-center gap-3 text-left transition-colors ${draft.specialistId === 'any' ? 'border-[#2D6BE4] bg-[#EBF0F9]' : 'border-[#E5E7EB] hover:border-[#2D6BE4]'}`}>
        <div className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-[#6B7280]" />
        </div>
        <span className="text-[#111827] flex-1" style={{ fontSize: '15px', fontWeight: 600 }}>Любой специалист</span>
        <Radio checked={draft.specialistId === 'any'} accentColor={accentColor} />
      </button>

      {specialists.map((s: Specialist) => {
        const checked = draft.specialistId === s.id;
        const price = svcs.length ? totalPrice(svcs, s.id, draft.carSize, info.employeePrices ?? []) : null;
        return (
          <div key={s.id} className={`rounded-xl border transition-colors ${checked ? 'border-[#2D6BE4] bg-[#EBF0F9]' : 'border-[#E5E7EB]'}`}>
            <div className="p-4 flex items-center gap-3">
              {s.avatarUrl ? (
                <img src={s.avatarUrl} alt={s.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#EBF0F9] flex items-center justify-center shrink-0 text-[#1B4F8A]" style={{ fontSize: '16px', fontWeight: 600 }}>
                  {s.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <button onClick={() => pick(s.id)} className="min-w-0 flex-1 text-left">
                <p className="text-[#111827]" style={{ fontSize: '15px', fontWeight: 600 }}>{s.name}</p>
                {s.jobTitle && <p className="text-[#6B7280] truncate" style={{ fontSize: '13px' }}>{s.jobTitle}</p>}
                {s.rating != null && (s.reviewCount ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 mt-1">
                    <Stars rating={s.rating} />
                    <span className="text-[#6B7280]" style={{ fontSize: '12px' }}>{s.reviewCount} {reviewsWord(s.reviewCount ?? 0)}</span>
                  </span>
                )}
                {price != null && <p className="text-[#111827] mt-1" style={{ fontSize: '15px', fontWeight: 700 }}>{formatPrice(price)}</p>}
              </button>
              <div className="flex items-center gap-2 shrink-0">
                {s.bio && (
                  <button onClick={() => setBioOpen(bioOpen === s.id ? null : s.id)} className="p-1.5 text-[#9CA3AF] hover:text-[#2D6BE4]" aria-label="О мастере">
                    <Info className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => pick(s.id)}><Radio checked={checked} accentColor={accentColor} /></button>
              </div>
            </div>
            {bioOpen === s.id && s.bio && (
              <p className="px-4 pb-4 -mt-1 text-[#6B7280]" style={{ fontSize: '13px', lineHeight: '1.5' }}>{s.bio}</p>
            )}
          </div>
        );
      })}

      {specialists.length === 0 && (
        <p className="text-center text-[#9CA3AF] py-6" style={{ fontSize: '13px' }}>
          Запись к конкретному специалисту пока недоступна
        </p>
      )}
    </div>
  );
}
