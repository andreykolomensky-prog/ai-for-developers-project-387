import { existsSync } from 'node:fs'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyInstance } from 'fastify'
import openapiGlue from 'fastify-openapi-glue'
import type { NotFoundError, ValidationError } from './generated/types.gen.ts'
import { createHandlers } from './handlers.ts'
import { defaultSchedule, type Schedule } from './schedule.ts'
import { Store } from './store.ts'

const defaultStaticDir = path.resolve(import.meta.dirname, '../dist/web')
const specification = path.resolve(import.meta.dirname, '../api/generated/openapi.yaml')

export type AppOptions = {
  logger?: boolean
  /** Каталог собранного фронтенда. Если его нет, сервер отдаёт только API. */
  staticDir?: string
  /** Хранилище. По умолчанию пустое. */
  store?: Store
  schedule?: Schedule
  /** Текущее время в миллисекундах эпохи. Подменяется в тестах. */
  now?: () => number
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    ajv: {
      // Проверяем запрос строго по контракту: без приведения типов и со всеми замечаниями сразу.
      customOptions: { coerceTypes: false, removeAdditional: false, allErrors: true },
    },
  })

  // Контракт описывает только JSON. Без встроенного разбора text/plain запрос с другим
  // типом содержимого отклоняется сразу и не попадает в обработчик мимо проверки схемой.
  app.removeContentTypeParser('text/plain')

  // Любой отказ в данных запроса отдаём в формате ValidationError из контракта.
  app.setErrorHandler((error, request, reply) => {
    const issues = requestIssues(error)
    if (issues) {
      const body: ValidationError = {
        code: 'validation_error',
        message: 'Данные запроса не прошли проверку',
        issues,
      }
      return reply.code(422).send(body)
    }
    request.log.error(error)
    return reply.send(error)
  })

  // Маршруты, проверка запросов и схемы ответов берутся из OpenAPI-спецификации.
  app.register(openapiGlue, {
    specification,
    serviceHandlers: createHandlers({
      store: options.store ?? new Store(),
      schedule: options.schedule ?? defaultSchedule,
      now: options.now ?? Date.now,
    }),
  })

  const staticDir = options.staticDir ?? defaultStaticDir
  const hasFrontend = existsSync(staticDir)
  if (hasFrontend) {
    app.register(fastifyStatic, { root: staticDir })
  } else {
    app.log.warn(`Каталог фронтенда ${staticDir} не найден: сервер отдаёт только API`)
  }

  app.setNotFoundHandler((request, reply) => {
    // Маршруты интерфейса обрабатывает клиентское приложение, поэтому отдаём ему index.html.
    if (hasFrontend && isPageRequest(request.method, request.url)) {
      return reply.sendFile('index.html')
    }
    const body: NotFoundError = { code: 'not_found', message: 'Не найдено' }
    return reply.code(404).send(body)
  })

  return app
}

/**
 * Запрос страницы интерфейса: GET или HEAD не к API и не к файлу. Путь с
 * расширением считается файлом, чтобы пропавший ассет получил 404, а не HTML.
 */
function isPageRequest(method: string, url: string): boolean {
  const pathname = url.split('?', 1)[0] ?? ''
  const isApi = pathname === '/api' || pathname.startsWith('/api/')
  return (method === 'GET' || method === 'HEAD') && !isApi && path.extname(pathname) === ''
}

type AjvIssue = { instancePath?: string; message?: string; params?: Record<string, unknown> }

/** Коды ошибок Fastify, означающие, что тело запроса нельзя прочитать как JSON. */
const unreadableBodyCodes = new Set([
  'FST_ERR_CTP_INVALID_JSON_BODY',
  'FST_ERR_CTP_EMPTY_JSON_BODY',
  'FST_ERR_CTP_INVALID_MEDIA_TYPE',
])

/** Замечания к данным запроса, если ошибка вызвана ими, иначе `undefined`. */
function requestIssues(error: unknown): ValidationError['issues'] | undefined {
  if (!(error instanceof Error)) {
    return undefined
  }
  if ('validation' in error && Array.isArray(error.validation)) {
    return (error.validation as AjvIssue[]).map((issue) => ({
      field: fieldOf(issue),
      message: issue.message ?? 'Некорректное значение',
    }))
  }
  if ('code' in error && typeof error.code === 'string' && unreadableBodyCodes.has(error.code)) {
    return [{ field: 'body', message: 'Тело запроса должно быть корректным JSON' }]
  }
  return undefined
}

/** Имя поля из замечания ajv: `/guestEmail` или пропущенное обязательное свойство. */
function fieldOf(issue: AjvIssue): string {
  const missing = issue.params?.missingProperty
  if (typeof missing === 'string') {
    return missing
  }
  return issue.instancePath?.replace(/^\//, '').replaceAll('/', '.') || 'body'
}
