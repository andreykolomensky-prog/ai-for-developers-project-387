import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../server/app.ts'
import type { EventType } from '../../server/generated/types.gen.ts'
import { Store } from '../../server/store.ts'
import { assertMatchesContract } from './contract.ts'

export type TestServer = {
  /** Запрос к запущенному серверу. Каждый ответ сверяется с контрактом. */
  api: <T = unknown>(method: string, url: string, body?: unknown) => Promise<ApiResponse<T>>
  /** Запрос с телом как есть, например с повреждённым JSON. Ответ тоже сверяется с контрактом. */
  raw: <T = unknown>(
    method: string,
    url: string,
    body: string,
    contentType?: string,
  ) => Promise<ApiResponse<T>>
  /** Переводит часы сервера на указанный момент. */
  setNow: (iso: string) => void
  close: () => Promise<void>
}

export type ApiResponse<T> = { status: number; body: T }

/**
 * Поднимает приложение на свободном порту с управляемыми часами и хранилищем
 * в памяти. Тесты ходят в него по HTTP, как настоящий клиент.
 */
export async function startServer(options: {
  now: string
  eventTypes?: EventType[]
}): Promise<TestServer> {
  let now = Date.parse(options.now)
  const app: FastifyInstance = buildApp({
    store: new Store(options.eventTypes),
    now: () => now,
    staticDir: '/nonexistent',
  })
  const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' })

  return {
    async api<T>(method: string, url: string, body?: unknown) {
      const response = await fetch(`${baseUrl}${url}`, {
        method,
        ...(body === undefined
          ? {}
          : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      const responseBody: unknown = await response.json()
      assertMatchesContract(method, url, response.status, responseBody)
      return { status: response.status, body: responseBody as T }
    },
    async raw<T>(method: string, url: string, body: string, contentType = 'application/json') {
      const response = await fetch(`${baseUrl}${url}`, {
        method,
        headers: { 'content-type': contentType },
        body,
      })
      const responseBody: unknown = await response.json()
      assertMatchesContract(method, url, response.status, responseBody)
      return { status: response.status, body: responseBody as T }
    },
    setNow(iso) {
      now = Date.parse(iso)
    },
    close: () => app.close(),
  }
}

export const meeting15: EventType = {
  id: 'meeting-15',
  title: 'Встреча 15 минут',
  description: 'Короткий звонок',
  durationMinutes: 15,
}

export const meeting30: EventType = {
  id: 'meeting-30',
  title: 'Встреча 30 минут',
  description: 'Базовая встреча',
  durationMinutes: 30,
}

export const meeting60: EventType = {
  id: 'meeting-60',
  title: 'Встреча 60 минут',
  description: 'Подробный разговор',
  durationMinutes: 60,
}
