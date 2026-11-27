import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type {
  Booking,
  BookingWindow,
  NotFoundError,
  SlotTakenError,
  ValidationError,
} from '../server/generated/types.gen.ts'
import { meeting15, meeting30, meeting60, startServer, type TestServer } from './support/server.ts'

let server: TestServer

/** Момент по московскому времени в виде, в котором его передаёт API. */
const msk = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`).toISOString()

const guest = { guestName: 'Анна Гостева', guestEmail: 'anna@example.com' }

function book(eventTypeId: string, startTime: string, patch: Record<string, unknown> = {}) {
  return server.api<Booking>('POST', '/api/bookings', {
    eventTypeId,
    startTime,
    ...guest,
    ...patch,
  })
}

async function slotAvailability(eventTypeId: string, startTime: string) {
  const response = await server.api<BookingWindow>(
    'GET',
    `/api/event-types/${eventTypeId}/booking-window`,
  )
  const slot = response.body.days
    .flatMap((day) => day.slots)
    .find((candidate) => candidate.startTime === startTime)
  return slot?.available
}

beforeEach(async () => {
  // Понедельник, 2 марта 2026 года, 10:30 по Москве.
  server = await startServer({
    now: '2026-03-02T07:30:00.000Z',
    eventTypes: [meeting15, meeting30, meeting60],
  })
})

afterEach(async () => {
  await server.close()
})

describe('создание записи', () => {
  test('гость записывается на свободный слот', async () => {
    const response = await book('meeting-30', msk('2026-03-03', '10:00'), {
      notes: 'Обсудим запуск',
    })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      eventType: meeting30,
      startTime: '2026-03-03T07:00:00.000Z',
      endTime: '2026-03-03T07:30:00.000Z',
      guestName: 'Анна Гостева',
      guestEmail: 'anna@example.com',
      notes: 'Обсудим запуск',
      createdAt: '2026-03-02T07:30:00.000Z',
    })
    expect(response.body.id).toEqual(expect.any(String))
  })

  test('заметка необязательна', async () => {
    const response = await book('meeting-30', msk('2026-03-03', '10:00'))

    expect(response.status).toBe(201)
    expect(response.body).not.toHaveProperty('notes')
  })

  test('гость оставляет телефон: он возвращается как введён, без пробелов по краям', async () => {
    const response = await book('meeting-30', msk('2026-03-03', '10:00'), {
      guestPhone: '  +7 (999) 123-45-67  ',
    })

    expect(response.status).toBe(201)
    expect(response.body.guestPhone).toBe('+7 (999) 123-45-67')
  })

  test.each([
    ['ровно 5 символов', '12345'],
    ['ровно 30 символов', '1'.repeat(30)],
  ])('телефон допустимой длины (%s) принимается', async (_name, guestPhone) => {
    const response = await book('meeting-30', msk('2026-03-03', '10:00'), { guestPhone })

    expect(response.status).toBe(201)
    expect(response.body.guestPhone).toBe(guestPhone)
  })

  test('телефон необязателен: без номера поля в ответе нет', async () => {
    const response = await book('meeting-30', msk('2026-03-03', '10:00'))

    expect(response.status).toBe(201)
    expect(response.body).not.toHaveProperty('guestPhone')
  })

  test('телефон из одних пробелов считается неуказанным', async () => {
    const response = await book('meeting-30', msk('2026-03-03', '10:00'), {
      guestPhone: '   ',
    })

    expect(response.status).toBe(201)
    expect(response.body).not.toHaveProperty('guestPhone')
  })

  test('занятый слот больше не предлагается как свободный', async () => {
    const startTime = msk('2026-03-03', '10:00')
    expect(await slotAvailability('meeting-30', startTime)).toBe(true)

    await book('meeting-30', startTime)

    expect(await slotAvailability('meeting-30', startTime)).toBe(false)
  })

  test('запись занимает время и в окне записи других типов встреч', async () => {
    await book('meeting-60', msk('2026-03-03', '10:00'))

    expect(await slotAvailability('meeting-30', msk('2026-03-03', '10:00'))).toBe(false)
    expect(await slotAvailability('meeting-30', msk('2026-03-03', '10:30'))).toBe(false)
    expect(await slotAvailability('meeting-15', msk('2026-03-03', '10:45'))).toBe(false)
    // Соседние слоты остаются свободными.
    expect(await slotAvailability('meeting-30', msk('2026-03-03', '09:30'))).toBe(true)
    expect(await slotAvailability('meeting-30', msk('2026-03-03', '11:00'))).toBe(true)
  })
})

describe('конфликт занятого времени', () => {
  test('повторная запись на тот же слот отклоняется с кодом 409', async () => {
    const startTime = msk('2026-03-03', '10:00')
    await book('meeting-30', startTime)

    const response = await server.api<SlotTakenError>('POST', '/api/bookings', {
      eventTypeId: 'meeting-30',
      startTime,
      guestName: 'Борис Второй',
      guestEmail: 'boris@example.com',
    })

    expect(response.status).toBe(409)
    expect(response.body.code).toBe('slot_taken')
    expect(response.body.message).toMatch(/занято/i)

    const bookings = await server.api<Booking[]>('GET', '/api/bookings')
    expect(bookings.body).toHaveLength(1)
    expect(bookings.body[0]?.guestName).toBe('Анна Гостева')
  })

  test('то же время нельзя занять другим типом встречи', async () => {
    await book('meeting-30', msk('2026-03-03', '10:00'))

    const response = await book('meeting-15', msk('2026-03-03', '10:00'))

    expect(response.status).toBe(409)
  })

  test('частичное наложение: после встречи на 60 минут в 10:00 запись на 30 минут в 10:30 отклоняется', async () => {
    const hour = await book('meeting-60', msk('2026-03-03', '10:00'))
    expect(hour.status).toBe(201)

    const overlapping = await server.api<SlotTakenError>('POST', '/api/bookings', {
      eventTypeId: 'meeting-30',
      startTime: msk('2026-03-03', '10:30'),
      ...guest,
    })

    expect(overlapping.status).toBe(409)
    expect(overlapping.body.code).toBe('slot_taken')
  })

  test('частичное наложение в обратном порядке: длинная встреча не ложится поверх короткой', async () => {
    await book('meeting-30', msk('2026-03-03', '10:30'))

    const response = await book('meeting-60', msk('2026-03-03', '10:00'))

    expect(response.status).toBe(409)
  })

  test('короткая встреча внутри длинной тоже отклоняется', async () => {
    await book('meeting-60', msk('2026-03-03', '10:00'))

    const response = await book('meeting-15', msk('2026-03-03', '10:15'))

    expect(response.status).toBe(409)
  })

  test('следующая встреча может начинаться в момент окончания предыдущей', async () => {
    await book('meeting-60', msk('2026-03-03', '10:00'))

    const after = await book('meeting-30', msk('2026-03-03', '11:00'))
    const before = await book('meeting-30', msk('2026-03-03', '09:30'))

    expect(after.status).toBe(201)
    expect(before.status).toBe(201)
  })

  test('из одновременных запросов на один слот проходит только один', async () => {
    const startTime = msk('2026-03-03', '10:00')

    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        book('meeting-30', startTime, { guestName: `Гость ${index + 1}` }),
      ),
    )

    const statuses = responses.map((response) => response.status)
    expect(statuses.filter((status) => status === 201)).toHaveLength(1)
    expect(statuses.filter((status) => status === 409)).toHaveLength(19)

    const bookings = await server.api<Booking[]>('GET', '/api/bookings')
    expect(bookings.body).toHaveLength(1)
  })

  test('из одновременных запросов разных типов на пересекающееся время проходит только один', async () => {
    const responses = await Promise.all([
      book('meeting-60', msk('2026-03-03', '10:00')),
      book('meeting-30', msk('2026-03-03', '10:30')),
      book('meeting-15', msk('2026-03-03', '10:45')),
    ])

    expect(responses.filter((response) => response.status === 201)).toHaveLength(1)
    expect(responses.filter((response) => response.status === 409)).toHaveLength(2)
  })
})

describe('ошибки данных при создании записи', () => {
  test.each([
    ['время не на сетке слотов', msk('2026-03-03', '10:10')],
    ['время до начала рабочего дня', msk('2026-03-03', '08:30')],
    ['слот, который закончится после рабочего дня', msk('2026-03-03', '18:00')],
    ['день за пределами окна записи', msk('2026-03-16', '10:00')],
    ['вчерашний день', msk('2026-03-01', '10:00')],
    ['слот, который сегодня уже начался', msk('2026-03-02', '10:30')],
  ])('%s отклоняется с кодом 422', async (_name, startTime) => {
    const response = await server.api<ValidationError>('POST', '/api/bookings', {
      eventTypeId: 'meeting-30',
      startTime,
      ...guest,
    })

    expect(response.status).toBe(422)
    expect(response.body.code).toBe('validation_error')
    expect(response.body.issues).toEqual([
      { field: 'startTime', message: expect.any(String) as string },
    ])
  })

  test('последний день окна записи доступен', async () => {
    const response = await book('meeting-30', msk('2026-03-15', '17:30'))

    expect(response.status).toBe(201)
  })

  test.each([
    ['пустое имя', { guestName: '' }, 'guestName'],
    ['имя из одних пробелов', { guestName: '   ' }, 'guestName'],
    ['некорректный email', { guestEmail: 'не-почта' }, 'guestEmail'],
    ['слишком короткий телефон', { guestPhone: '1234' }, 'guestPhone'],
    ['слишком длинный телефон', { guestPhone: '1'.repeat(31) }, 'guestPhone'],
    ['недопустимые символы в телефоне', { guestPhone: 'phone123' }, 'guestPhone'],
    ['телефон без цифр', { guestPhone: '+-+-+-' }, 'guestPhone'],
    ['время не в формате даты', { startTime: 'завтра в десять' }, 'startTime'],
    ['слишком длинная заметка', { notes: 'я'.repeat(501) }, 'notes'],
  ])('%s отклоняется с кодом 422', async (_name, patch, field) => {
    const response = await server.api<ValidationError>('POST', '/api/bookings', {
      eventTypeId: 'meeting-30',
      startTime: msk('2026-03-03', '10:00'),
      ...guest,
      ...patch,
    })

    expect(response.status).toBe(422)
    expect(response.body.issues.map((issue) => issue.field)).toContain(field)
    // Отклонённый запрос слот не занимает.
    expect(await slotAvailability('meeting-30', msk('2026-03-03', '10:00'))).toBe(true)
  })

  test('сообщение для телефона без цифр упоминает хотя бы одну цифру', async () => {
    const response = await server.api<ValidationError>('POST', '/api/bookings', {
      eventTypeId: 'meeting-30',
      startTime: msk('2026-03-03', '10:00'),
      ...guest,
      guestPhone: '+-+-+-',
    })

    expect(response.status).toBe(422)
    expect(response.body.issues).toEqual([
      { field: 'guestPhone', message: expect.stringMatching(/хотя бы одну цифру/i) as string },
    ])
  })

  test.each([
    ['повреждённый JSON', '{"eventTypeId":', 'application/json'],
    ['пустое тело', '', 'application/json'],
    ['тело не в формате JSON', 'eventTypeId=meeting-30', 'text/plain'],
  ])('%s отклоняется с кодом 422 в формате контракта', async (_name, body, contentType) => {
    const response = await server.raw<ValidationError>('POST', '/api/bookings', body, contentType)

    expect(response.status).toBe(422)
    expect(response.body.code).toBe('validation_error')
    expect(response.body.issues).toEqual([{ field: 'body', message: expect.any(String) as string }])
  })

  test('неизвестный тип встречи отвечает 404', async () => {
    const response = await server.api<NotFoundError>('POST', '/api/bookings', {
      eventTypeId: 'unknown',
      startTime: msk('2026-03-03', '10:00'),
      ...guest,
    })

    expect(response.status).toBe(404)
    expect(response.body.code).toBe('not_found')
  })

  test('отклонённый запрос не создаёт запись', async () => {
    await book('meeting-30', msk('2026-03-03', '10:10'))

    const bookings = await server.api<Booking[]>('GET', '/api/bookings')
    expect(bookings.body).toEqual([])
  })
})

describe('предстоящие встречи владельца', () => {
  test('в одном списке записи всех типов встреч по возрастанию времени начала', async () => {
    await book('meeting-60', msk('2026-03-05', '14:00'), { guestName: 'Третий' })
    await book('meeting-15', msk('2026-03-03', '09:00'), { guestName: 'Первый' })
    await book('meeting-30', msk('2026-03-03', '12:00'), { guestName: 'Второй' })

    const response = await server.api<Booking[]>('GET', '/api/bookings')

    expect(response.status).toBe(200)
    expect(response.body.map((booking) => [booking.guestName, booking.eventType.id])).toEqual([
      ['Первый', 'meeting-15'],
      ['Второй', 'meeting-30'],
      ['Третий', 'meeting-60'],
    ])
  })

  test('пока записей нет, список пуст', async () => {
    const response = await server.api<Booking[]>('GET', '/api/bookings')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([])
  })

  test('закончившаяся встреча из списка пропадает, идущая остаётся', async () => {
    await book('meeting-30', msk('2026-03-03', '10:00'))

    server.setNow(msk('2026-03-03', '10:15'))
    expect((await server.api<Booking[]>('GET', '/api/bookings')).body).toHaveLength(1)

    server.setNow(msk('2026-03-03', '10:30'))
    expect((await server.api<Booking[]>('GET', '/api/bookings')).body).toHaveLength(0)
  })
})
