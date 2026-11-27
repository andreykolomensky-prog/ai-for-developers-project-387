import { afterEach, describe, expect, test } from 'vitest'
import type { BookingWindow, NotFoundError } from '../server/generated/types.gen.ts'
import { meeting30, meeting60, startServer, type TestServer } from './support/server.ts'

let server: TestServer

afterEach(async () => {
  await server.close()
})

const meeting45 = { ...meeting30, id: 'meeting-45', durationMinutes: 45 }

async function bookingWindow(eventTypeId: string) {
  const response = await server.api<BookingWindow>(
    'GET',
    `/api/event-types/${eventTypeId}/booking-window`,
  )
  expect(response.status).toBe(200)
  return response.body
}

describe('окно записи', () => {
  test('занимает 14 календарных дней, начиная с сегодняшнего в часовом поясе владельца', async () => {
    // Понедельник, 10:30 по Москве.
    server = await startServer({ now: '2026-03-02T07:30:00.000Z', eventTypes: [meeting30] })

    const window = await bookingWindow('meeting-30')

    expect(window.timeZone).toBe('Europe/Moscow')
    expect(window.days).toHaveLength(14)
    expect(window.days[0]?.date).toBe('2026-03-02')
    expect(window.days[13]?.date).toBe('2026-03-15')
  })

  test('сегодняшний день считается по Москве, а не по UTC', async () => {
    // 00:30 третьего марта по Москве, в UTC ещё второе.
    server = await startServer({ now: '2026-03-02T21:30:00.000Z', eventTypes: [meeting30] })

    const window = await bookingWindow('meeting-30')

    expect(window.days[0]?.date).toBe('2026-03-03')
    expect(window.days[13]?.date).toBe('2026-03-16')
  })

  test('слоты заполняют рабочие часы с 09:00 до 18:00 по Москве', async () => {
    server = await startServer({ now: '2026-03-02T07:30:00.000Z', eventTypes: [meeting30] })

    const window = await bookingWindow('meeting-30')

    for (const day of window.days) {
      expect(day.slots).toHaveLength(18)
      expect(day.slots[0]?.startTime).toBe(`${day.date}T06:00:00.000Z`)
      expect(day.slots[17]?.endTime).toBe(`${day.date}T15:00:00.000Z`)
    }
  })

  test.each([
    [meeting30, 18],
    [meeting45, 12],
    [meeting60, 9],
  ])(
    'слот длится столько, сколько тип встречи, и следующий начинается сразу за ним',
    async (eventType, slotsPerDay) => {
      server = await startServer({ now: '2026-03-02T07:30:00.000Z', eventTypes: [eventType] })

      const window = await bookingWindow(eventType.id)
      const slots = window.days[1]!.slots

      expect(slots).toHaveLength(slotsPerDay)
      const durations = slots.map((slot) => Date.parse(slot.endTime) - Date.parse(slot.startTime))
      expect(new Set(durations)).toEqual(new Set([eventType.durationMinutes * 60_000]))
      // Каждый следующий слот начинается в момент окончания предыдущего.
      expect(slots.slice(1).map((slot) => slot.startTime)).toEqual(
        slots.slice(0, -1).map((slot) => slot.endTime),
      )
    },
  )

  test('встреча, которая не помещается в остаток рабочего дня, не предлагается', async () => {
    const meeting400 = { ...meeting30, id: 'meeting-400', durationMinutes: 400 }
    server = await startServer({ now: '2026-03-02T07:30:00.000Z', eventTypes: [meeting400] })

    const window = await bookingWindow('meeting-400')

    // В 540 рабочих минут помещается только один слот на 400 минут.
    expect(window.days[1]!.slots).toHaveLength(1)
  })

  test('уже начавшиеся сегодня слоты недоступны, остальные свободны', async () => {
    // 10:30 по Москве: слот 10:30 уже начался, ближайший свободный в 11:00.
    server = await startServer({ now: '2026-03-02T07:30:00.000Z', eventTypes: [meeting30] })

    const window = await bookingWindow('meeting-30')
    const today = window.days[0]!.slots
    const available = today.filter((slot) => slot.available)

    expect(available[0]?.startTime).toBe('2026-03-02T08:00:00.000Z')
    expect(today.filter((slot) => !slot.available)).toHaveLength(4)
    expect(window.days[1]!.slots.every((slot) => slot.available)).toBe(true)
  })

  test('неизвестный тип встречи отвечает 404', async () => {
    server = await startServer({ now: '2026-03-02T07:30:00.000Z' })

    const response = await server.api<NotFoundError>(
      'GET',
      '/api/event-types/unknown/booking-window',
    )

    expect(response.status).toBe(404)
    expect(response.body.code).toBe('not_found')
  })
})
