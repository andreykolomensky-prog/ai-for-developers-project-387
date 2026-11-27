import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { buildApp } from '../server/app.ts'

let staticDir: string
let app: FastifyInstance

beforeAll(async () => {
  staticDir = await mkdtemp(path.join(tmpdir(), 'call-calendar-web-'))
  await writeFile(
    path.join(staticDir, 'index.html'),
    '<!doctype html><title>Запись на звонок</title>',
  )
  app = buildApp({ staticDir })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await rm(staticDir, { recursive: true, force: true })
})

test('главная страница отдаётся с кодом 200', async () => {
  const response = await app.inject({ method: 'GET', url: '/' })

  expect(response.statusCode).toBe(200)
  expect(response.headers['content-type']).toContain('text/html')
  expect(response.body).toContain('Запись на звонок')
})

test('адреса интерфейса получают index.html, маршрутизация остаётся клиенту', async () => {
  const response = await app.inject({ method: 'GET', url: '/book' })

  expect(response.statusCode).toBe(200)
  expect(response.headers['content-type']).toContain('text/html')
})

test('страницу интерфейса можно запросить методом HEAD', async () => {
  const response = await app.inject({ method: 'HEAD', url: '/book' })

  expect(response.statusCode).toBe(200)
  expect(response.headers['content-type']).toContain('text/html')
})

test('пропавший файл отвечает 404, а не страницей интерфейса', async () => {
  const response = await app.inject({ method: 'GET', url: '/assets/index-old.js' })

  expect(response.statusCode).toBe(404)
  expect(response.headers['content-type']).toContain('application/json')
})

test.each(['/api/unknown', '/api', '/api?debug=1'])(
  'неизвестный адрес API %s отвечает 404 в формате ошибки, а не страницей интерфейса',
  async (url) => {
    const response = await app.inject({ method: 'GET', url })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ code: 'not_found', message: 'Не найдено' })
  },
)

test('без собранного фронтенда сервер отдаёт только API и отвечает 404 на страницы', async () => {
  const apiOnly = buildApp({ staticDir: path.join(staticDir, 'missing') })

  const page = await apiOnly.inject({ method: 'GET', url: '/' })
  const health = await apiOnly.inject({ method: 'GET', url: '/api/health' })
  await apiOnly.close()

  expect(page.statusCode).toBe(404)
  expect(page.json()).toEqual({ code: 'not_found', message: 'Не найдено' })
  expect(health.statusCode).toBe(200)
})
