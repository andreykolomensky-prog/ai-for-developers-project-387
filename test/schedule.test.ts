import { afterEach, expect, test } from 'vitest'
import type { BookingWindow, Schedule } from '../server/generated/types.gen.ts'
import { meeting30, startServer, type TestServer } from './support/server.ts'

let server: TestServer

afterEach(async () => {
  await server.close()
})

test('расписание владельца: часовой пояс, рабочие часы и длина окна записи', async () => {
  server = await startServer({ now: '2026-03-02T07:30:00.000Z' })

  const response = await server.api<Schedule>('GET', '/api/schedule')

  expect(response.status).toBe(200)
  expect(response.body).toEqual({
    timeZone: 'Europe/Moscow',
    workDayStart: '09:00',
    workDayEnd: '18:00',
    windowDays: 14,
  })
})

test('окно записи построено по тому же расписанию', async () => {
  server = await startServer({ now: '2026-03-02T07:30:00.000Z', eventTypes: [meeting30] })

  const schedule = (await server.api<Schedule>('GET', '/api/schedule')).body
  const window = (
    await server.api<BookingWindow>('GET', '/api/event-types/meeting-30/booking-window')
  ).body

  expect(window.timeZone).toBe(schedule.timeZone)
  expect(window.days).toHaveLength(schedule.windowDays)
})
