import type {
  Booking,
  BookingWindow,
  CreateBookingRequest,
  EventType,
  Schedule,
} from '../api/generated/index.ts'

type FakeApi = {
  eventTypes: EventType[]
  /** Окна записи по идентификатору типа встречи. */
  bookingWindows: Record<string, BookingWindow>
  /** Запросы на запись, которые отправил интерфейс. */
  bookingRequests: CreateBookingRequest[]
  /** Начала слотов, которые успел занять другой гость: запись на них получает 409. */
  takenStarts: string[]
  /** Предстоящие встречи, которые видит владелец. */
  bookings: Booking[]
  /** Адреса, которые сервер считает некорректными: запись с ними получает 422. */
  rejectedEmails: string[]
  /** Телефоны, которые сервер считает некорректными: запись с ними получает 422. */
  rejectedPhones: string[]
  schedule: Schedule
}

const moscowSchedule: Schedule = {
  timeZone: 'Europe/Moscow',
  workDayStart: '09:00',
  workDayEnd: '18:00',
  windowDays: 14,
}

/**
 * Данные, которые видит SDK в компонентных тестах. Тест кладёт сюда нужное
 * состояние, после каждого теста оно сбрасывается.
 */
export const fakeApi: FakeApi = {
  eventTypes: [],
  bookingWindows: {},
  bookingRequests: [],
  takenStarts: [],
  bookings: [],
  rejectedEmails: [],
  rejectedPhones: [],
  schedule: moscowSchedule,
}

export function resetFakeApi() {
  fakeApi.eventTypes = []
  fakeApi.bookingWindows = {}
  fakeApi.bookingRequests = []
  fakeApi.takenStarts = []
  fakeApi.bookings = []
  fakeApi.rejectedEmails = []
  fakeApi.rejectedPhones = []
  fakeApi.schedule = moscowSchedule
}

const notFound = () => Response.json({ code: 'not_found', message: 'Не найдено' }, { status: 404 })

/** Принимает запись и отвечает так, как ответил бы сервер: 201 или 409 для занятого времени. */
async function createBooking(request: Request): Promise<Response> {
  const body = (await request.json()) as CreateBookingRequest
  const eventType = fakeApi.eventTypes.find((candidate) => candidate.id === body.eventTypeId)
  if (!eventType) {
    return notFound()
  }
  fakeApi.bookingRequests.push(body)
  if (fakeApi.rejectedEmails.includes(body.guestEmail)) {
    return Response.json(
      {
        code: 'validation_error',
        message: 'Данные запроса не прошли проверку',
        issues: [{ field: 'guestEmail', message: 'must match format "email"' }],
      },
      { status: 422 },
    )
  }
  if (body.guestPhone && fakeApi.rejectedPhones.includes(body.guestPhone)) {
    return Response.json(
      {
        code: 'validation_error',
        message: 'Данные запроса не прошли проверку',
        issues: [{ field: 'guestPhone', message: 'invalid phone' }],
      },
      { status: 422 },
    )
  }
  if (fakeApi.takenStarts.includes(body.startTime)) {
    // Как и настоящий сервер, после отказа отдаём слот занятым.
    for (const day of fakeApi.bookingWindows[eventType.id]?.days ?? []) {
      for (const slot of day.slots) {
        slot.available &&= slot.startTime !== body.startTime
      }
    }
    return Response.json(
      { code: 'slot_taken', message: 'Это время уже занято. Выберите другой слот' },
      { status: 409 },
    )
  }
  const { eventTypeId: _eventTypeId, ...details } = body
  const booking: Booking = {
    ...details,
    id: `booking-${fakeApi.bookingRequests.length}`,
    eventType,
    endTime: new Date(
      Date.parse(body.startTime) + eventType.durationMinutes * 60_000,
    ).toISOString(),
    createdAt: body.startTime,
  }
  return Response.json(booking, { status: 201 })
}

/** Замена `fetch` для SDK: отвечает на запросы контракта из `fakeApi`. */
export async function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  const { pathname } = new URL(input instanceof Request ? input.url : String(input))
  if (pathname === '/api/event-types') {
    return Response.json(fakeApi.eventTypes)
  }
  if (pathname === '/api/schedule') {
    return Response.json(fakeApi.schedule)
  }
  if (pathname === '/api/bookings') {
    return input instanceof Request && input.method === 'POST'
      ? createBooking(input)
      : Response.json(fakeApi.bookings)
  }

  const [, eventTypeId, resource] = /^\/api\/event-types\/([^/]+)(?:\/(.+))?$/.exec(pathname) ?? []
  const eventType = fakeApi.eventTypes.find((candidate) => candidate.id === eventTypeId)
  if (!eventType) {
    return notFound()
  }
  if (!resource) {
    return Response.json(eventType)
  }
  const bookingWindow = fakeApi.bookingWindows[eventType.id]
  return resource === 'booking-window' && bookingWindow ? Response.json(bookingWindow) : notFound()
}
