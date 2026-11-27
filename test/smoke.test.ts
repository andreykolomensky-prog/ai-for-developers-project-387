import { afterAll, beforeAll, expect, test } from 'vitest'
import { buildApp } from '../server/app.ts'

const app = buildApp()
let baseUrl: string

beforeAll(async () => {
  baseUrl = await app.listen({ port: 0, host: '127.0.0.1' })
})

afterAll(async () => {
  await app.close()
})

test('smoke: приложение запускается и отвечает на запрос', async () => {
  const response = await fetch(`${baseUrl}/api/health`)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})
