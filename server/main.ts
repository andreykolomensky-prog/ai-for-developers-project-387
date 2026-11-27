import { buildApp } from './app.ts'
import { resolvePort } from './port.ts'
import { Store } from './store.ts'

const port = resolvePort(process.env.PORT)
const host = process.env.HOST ?? '0.0.0.0'

// Данные живут в памяти, поэтому после запуска заводим типы встреч, с которых гость может начать.
const store = new Store([
  {
    id: 'meeting-15',
    title: 'Встреча 15 минут',
    description: 'Короткий звонок, чтобы познакомиться или быстро сверить планы.',
    durationMinutes: 15,
  },
  {
    id: 'meeting-30',
    title: 'Встреча 30 минут',
    description: 'Базовая встреча для обсуждения одного вопроса.',
    durationMinutes: 30,
  },
])

const app = buildApp({ logger: true, store })

// В контейнере процесс получает SIGTERM при остановке: завершаем начатые запросы и выходим.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info(`Получен ${signal}, останавливаем сервер`)
    void app.close().then(() => process.exit(0))
  })
}

try {
  await app.listen({ port, host })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
