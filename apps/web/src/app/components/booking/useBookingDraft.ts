// «Черновик записи» — единый источник истины для свободного хаба (Этап 1).
import { useReducer } from 'react';
import type { BookingDraft, ContactInfo } from './types';

export const INITIAL_DRAFT: BookingDraft = {
  serviceIds: [],
  carSize: null,
  specialistId: 'any',
  date: null,
  slot: null,
  contact: { name: '', phone: '', email: '', comment: '' },
  reminderMinutes: 60,
  consent: false,
};

export type DraftAction =
  | { type: 'toggleService'; serviceId: string }
  | { type: 'setSpecialist'; specialistId: string }
  | { type: 'setCarSize'; carSize: BookingDraft['carSize'] }
  | { type: 'setDate'; date: string }
  | { type: 'setSlot'; slot: BookingDraft['slot'] }
  | { type: 'setContact'; field: keyof ContactInfo; value: string }
  | { type: 'setReminder'; minutes: number }
  | { type: 'setConsent'; consent: boolean }
  | { type: 'reset' };

export function draftReducer(state: BookingDraft, action: DraftAction): BookingDraft {
  switch (action.type) {
    case 'toggleService': {
      // состав услуг влияет на длительность/цену → сбрасываем слот
      const has = state.serviceIds.includes(action.serviceId);
      const serviceIds = has
        ? state.serviceIds.filter((id) => id !== action.serviceId)
        : [...state.serviceIds, action.serviceId];
      return { ...state, serviceIds, slot: null };
    }
    case 'setSpecialist':
      // доступность зависит от мастера → сбрасываем слот
      return { ...state, specialistId: action.specialistId, slot: null };
    case 'setCarSize':
      return { ...state, carSize: action.carSize };
    case 'setDate':
      return { ...state, date: action.date, slot: null };
    case 'setSlot':
      return { ...state, slot: action.slot };
    case 'setContact':
      return { ...state, contact: { ...state.contact, [action.field]: action.value } };
    case 'setReminder':
      return { ...state, reminderMinutes: action.minutes };
    case 'setConsent':
      return { ...state, consent: action.consent };
    case 'reset':
      return INITIAL_DRAFT;
    default:
      return state;
  }
}

export function useBookingDraft() {
  return useReducer(draftReducer, INITIAL_DRAFT);
}
