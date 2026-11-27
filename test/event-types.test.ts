import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type {
  EventType,
  EventTypeExistsError,
  NotFoundError,
  ValidationError,
} from '../server/generated/types.gen.ts'
import { meeting30, startServer, type TestServer } from './support/server.ts'

let server: TestServer

beforeEach(async () => {
  server = await startServer({ now: '2026-03-02T07:30:00.000Z' })
})

afterEach(async () => {
  await server.close()
})

describe('типы встреч', () => {
  test('пока владелец ничего не создал, список пуст', async () => {
    const response = await server.api<EventType[]>('GET', '/api/event-types')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([])
  })

  test('владелец создаёт тип встречи, и он появляется в списке', async () => {
    const created = await server.api<EventType>('POST', '/api/event-types', meeting30)

    expect(created.status).toBe(201)
    expect(created.body).toEqual(meeting30)

    const list = await server.api<EventType[]>('GET', '/api/event-types')
    expect(list.body).toEqual([meeting30])

    const single = await server.api<EventType>('GET', '/api/event-types/meeting-30')
    expect(single.status).toBe(200)
    expect(single.body).toEqual(meeting30)
  })

  test('типы встреч отдаются в порядке создания', async () => {
    await server.api('POST', '/api/event-types', { ...meeting30, id: 'second-created-first' })
    await server.api('POST', '/api/event-types', { ...meeting30, id: 'a-created-second' })

    const list = await server.api<EventType[]>('GET', '/api/event-types')

    expect(list.body.map((eventType) => eventType.id)).toEqual([
      'second-created-first',
      'a-created-second',
    ])
  })

  test('повторный идентификатор отклоняется с кодом 409', async () => {
    await server.api('POST', '/api/event-types', meeting30)

    const response = await server.api<EventTypeExistsError>('POST', '/api/event-types', {
      ...meeting30,
      title: 'Другое название',
    })

    expect(response.status).toBe(409)
    expect(response.body.code).toBe('event_type_exists')
  })

  test('неизвестный тип встречи отвечает 404', async () => {
    const response = await server.api<NotFoundError>('GET', '/api/event-types/unknown')

    expect(response.status).toBe(404)
    expect(response.body.code).toBe('not_found')
  })

  test.each([
    ['пустое название', { title: '' }, 'title'],
    ['название из одних пробелов', { title: '   ' }, 'title'],
    ['нулевая длительность', { durationMinutes: 0 }, 'durationMinutes'],
    ['длительность больше рабочего дня', { durationMinutes: 481 }, 'durationMinutes'],
    ['дробная длительность', { durationMinutes: 22.5 }, 'durationMinutes'],
    ['длительность строкой', { durationMinutes: '30' }, 'durationMinutes'],
    ['идентификатор с пробелами и кириллицей', { id: 'Моя встреча' }, 'id'],
  ])('ошибка данных: %s', async (_name, patch, field) => {
    const response = await server.api<ValidationError>('POST', '/api/event-types', {
      ...meeting30,
      ...patch,
    })

    expect(response.status).toBe(422)
    expect(response.body.code).toBe('validation_error')
    expect(response.body.issues.map((issue) => issue.field)).toContain(field)

    const list = await server.api<EventType[]>('GET', '/api/event-types')
    expect(list.body).toEqual([])
  })

  test('пропущенные обязательные поля перечисляются в ответе', async () => {
    const response = await server.api<ValidationError>('POST', '/api/event-types', {
      id: 'no-fields',
    })

    expect(response.status).toBe(422)
    expect(response.body.issues.map((issue) => issue.field).toSorted()).toEqual([
      'description',
      'durationMinutes',
      'title',
    ])
  })
})
