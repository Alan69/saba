// Публичный виджет записи — свободный хаб (Altegio-style, Этап 1).
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Loader2, MapPin, ChevronLeft, User } from 'lucide-react';
import { toast } from 'sonner';
import { apiPublic, apiPublicPost, ApiError } from '../../lib/api';
import type { Screen, WidgetInfo } from './types';
import { useBookingDraft } from './useBookingDraft';
import { normalizePhone } from './lib/validation';
import { selectedServices, totalPrice } from './lib/selection';
import { HubScreen } from './screens/HubScreen';
import { ServicesScreen } from './screens/ServicesScreen';
import { SpecialistScreen } from './screens/SpecialistScreen';
import { DateTimeScreen } from './screens/DateTimeScreen';
import { DetailsScreen } from './screens/DetailsScreen';
import { ConfirmationScreen } from './screens/ConfirmationScreen';

export function BookingWidget() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [info, setInfo] = useState<WidgetInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [screen, setScreen] = useState<Screen>('hub');
  const [draft, dispatch] = useBookingDraft();
  const [booking, setBooking] = useState(false);
  const [bookingCode, setBookingCode] = useState('');

  useEffect(() => {
    if (!slug) return;
    apiPublic(`/widget/${slug}`)
      .then(setInfo)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Не удалось загрузить'));
  }, [slug]);

  const services = useMemo(() => (info ? selectedServices(info, draft) : []), [info, draft.serviceIds]);
  const specialist = useMemo(
    () => info?.specialists?.find((s) => s.id === draft.specialistId),
    [info, draft.specialistId],
  );
  const specialistName = draft.specialistId === 'any' ? 'Любой специалист' : (specialist?.name ?? 'Специалист');
  const price = info ? totalPrice(services, draft.specialistId, draft.carSize, info.employeePrices ?? []) : 0;
  const accentColor = info?.accentColor || '#2D6BE4';

  const handleBook = async () => {
    if (!slug || !draft.slot || !services.length) return;
    setBooking(true);
    try {
      const reserve = await apiPublicPost(`/widget/${slug}/reserve`, {
        startAt: draft.slot.startAt,
        serviceIds: draft.serviceIds,
        boxId: draft.slot.boxId,
      });
      const result = await apiPublicPost(`/widget/${slug}/book`, {
        reservationToken: reserve.reservationToken,
        boxId: reserve.boxId,
        startAt: draft.slot.startAt,
        serviceIds: draft.serviceIds,
        phone: normalizePhone(draft.contact.phone),
        name: draft.contact.name || undefined,
        email: draft.contact.email.trim() || undefined,
        comment: draft.contact.comment.trim() || undefined,
        carSize: draft.carSize || undefined,
        reminderMinutes: draft.reminderMinutes || undefined,
        employeeId: draft.specialistId !== 'any' ? draft.specialistId : undefined,
        waConsent: draft.consent,
      });
      setBookingCode(result.code);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Не удалось создать запись');
      if (e instanceof ApiError && e.status === 409) setScreen('datetime'); // слот заняли
    } finally {
      setBooking(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="text-center">
          <p className="text-[#111827]" style={{ fontSize: '18px', fontWeight: 600 }}>{loadError}</p>
          <p className="text-[#6B7280] mt-2" style={{ fontSize: '14px' }}>Проверьте ссылку на запись</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#2D6BE4] animate-spin" />
      </div>
    );
  }

  if (bookingCode) {
    return (
      <ConfirmationScreen
        info={info} draft={draft} price={price} services={services}
        code={bookingCode} accentColor={accentColor}
        onCabinet={() => navigate(`/client/${slug}`)}
      />
    );
  }

  const showHeaderBack = screen !== 'hub';

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="px-4 py-4 border-b border-[#E5E7EB]">
        <div className="max-w-[480px] mx-auto flex items-center gap-3">
          {showHeaderBack && (
            <button onClick={() => setScreen('hub')} className="p-1 -ml-1 text-[#6B7280] hover:text-[#111827]" aria-label="Назад">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-9 h-9 rounded-full bg-[#111827] text-white flex items-center justify-center shrink-0" style={{ fontSize: '13px', fontWeight: 700 }}>
            {info.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-[#111827] truncate" style={{ fontSize: '16px', fontWeight: 700 }}>{info.name}</h1>
            {info.address && (
              <p className="text-[#6B7280] flex items-center gap-1 truncate" style={{ fontSize: '12px' }}>
                <MapPin className="w-3 h-3 shrink-0" /> {info.address}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[480px] mx-auto px-4 py-5">
          {screen === 'hub' && (
            <HubScreen info={info} draft={draft} services={services} specialistName={specialistName} accentColor={accentColor} onPick={setScreen} />
          )}
          {screen === 'services' && (
            <ServicesScreen
              info={info} draft={draft} dispatch={dispatch} accentColor={accentColor}
              onProceed={() => setScreen('hub')}
            />
          )}
          {screen === 'specialist' && (
            <SpecialistScreen
              info={info} draft={draft} dispatch={dispatch} accentColor={accentColor}
              onProceed={() => setScreen('hub')}
            />
          )}
          {screen === 'datetime' && (
            <DateTimeScreen
              slug={slug!} info={info} draft={draft} dispatch={dispatch} accentColor={accentColor}
              onPickService={() => setScreen('services')}
              onProceed={() => setScreen('hub')}
            />
          )}
          {screen === 'details' && (
            <DetailsScreen
              info={info} draft={draft} dispatch={dispatch} services={services} price={price}
              specialistName={specialistName} accentColor={accentColor}
              booking={booking} onEdit={setScreen} onBook={handleBook}
            />
          )}
        </div>
      </div>

      {info.poweredBy && (
        <div className="py-3 text-center border-t border-[#F3F4F6]">
          <span className="text-[#9CA3AF]" style={{ fontSize: '12px' }}>
            <User className="w-3 h-3 inline mr-1" />Работает на <span style={{ fontWeight: 600 }}>Saba</span>
          </span>
        </div>
      )}
    </div>
  );
}
