import { randomUUID } from 'node:crypto'
import type { BookingWindow, CreateBookingRequest, EventType } from './generated/types.gen.ts'
import { daySlots, overlaps, type Schedule, windowDates } from './schedule.ts'
import type { Store, StoredBooking } from './store.ts'

export type BookingRules = {
  store: Store
  schedule: Schedule
  /** Текущее время в миллисекундах эпохи. Подменяется в тестах. */
  now: () => number
}

const toIso = (instant: number) => new Date(instant).toISOString()

/** Окно записи для типа встречи: слоты всех дней окна с отметкой занятости. */
export function buildBookingWindow(eventType: EventType, rules: BookingRules): BookingWindow {
  const { store, schedule } = rules
  const now = rules.now()
  const bookings = store.listBookings()

  return {
    timeZone: schedule.timeZone,
    days: windowDates(now, schedule).map((date) => ({
      date: date.toString(),
      slots: daySlots(date, eventType.durationMinutes, schedule).map((slot) => ({
        startTime: toIso(slot.start),
        endTime: toIso(slot.end),
        available: slot.start > now && !bookings.some((booking) => overlaps(slot, booking)),
      })),
    })),
  }
}

export type CreateBookingResult =
  | { ok: true; booking: StoredBooking }
  | {
      ok: false
      reason:
        | 'event_type_not_found'
        | 'invalid_phone'
        | 'not_a_slot'
        | 'slot_started'
        | 'slot_taken'
    }

/** Допустимые символы телефона: цифры, `+`, пробелы, дефисы и скобки. */
const phoneSymbols = /^[\d+ ()-]+$/

/** Мягкая проверка телефона: 5–30 символов, допустимые символы и хотя бы одна цифра. */
function isGuestPhoneValid(phone: string): boolean {
  return phone.length >= 5 && phone.length <= 30 && phoneSymbols.test(phone) && /\d/.test(phone)
}

/**
 * Создаёт запись, если выбранное время является слотом окна записи, слот ещё
 * не начался и не пересекается ни с одной записью любого типа встречи.
 * Проверка и добавление выполняются синхронно, поэтому из двух одновременных
 * запросов на одно время успешным будет только один.
 */
export function createBooking(
  request: CreateBookingRequest,
  rules: BookingRules,
): CreateBookingResult {
  const { store, schedule } = rules
  const now = rules.now()

  const eventType = store.getEventType(request.eventTypeId)
  if (!eventType) {
    return { ok: false, reason: 'event_type_not_found' }
  }

  const guestPhone = request.guestPhone?.trim()
  if (guestPhone && !isGuestPhoneValid(guestPhone)) {
    return { ok: false, reason: 'invalid_phone' }
  }

  const start = Date.parse(request.startTime)
  const slot = windowDates(now, schedule)
    .flatMap((date) => daySlots(date, eventType.durationMinutes, schedule))
    .find((candidate) => candidate.start === start)
  if (!slot) {
    return { ok: false, reason: 'not_a_slot' }
  }
  if (slot.start <= now) {
    return { ok: false, reason: 'slot_started' }
  }
  if (store.listBookings().some((booking) => overlaps(slot, booking))) {
    return { ok: false, reason: 'slot_taken' }
  }

  const booking: StoredBooking = {
    id: randomUUID(),
    eventType,
    start: slot.start,
    end: slot.end,
    guestName: request.guestName.trim(),
    guestEmail: request.guestEmail.trim(),
    createdAt: now,
  }
  if (guestPhone) {
    booking.guestPhone = guestPhone
  }
  const notes = request.notes?.trim()
  if (notes) {
    booking.notes = notes
  }
  store.addBooking(booking)
  return { ok: true, booking }
}

/** Предстоящие записи: ещё не закончившиеся, по возрастанию времени начала. */
export function listUpcomingBookings(rules: BookingRules): StoredBooking[] {
  const now = rules.now()
  return rules.store
    .listBookings()
    .filter((booking) => booking.end > now)
    .toSorted((a, b) => a.start - b.start)
}
