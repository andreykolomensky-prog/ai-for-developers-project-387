import { defineConfig } from '@hey-api/openapi-ts'

const input = 'api/generated/openapi.yaml'

export default defineConfig([
  {
    // Клиентский SDK: фронтенд ходит в API только через него.
    input,
    output: 'web/src/api/generated',
    plugins: [
      // Адреса в контракте уже начинаются с /api, поэтому базовый адрес не нужен.
      { name: '@hey-api/client-fetch', baseUrl: false },
      '@hey-api/typescript',
      '@hey-api/sdk',
    ],
  },
  {
    // Серверные артефакты: типы запросов и ответов и типы обработчиков Fastify.
    input,
    // Node.js исполняет сервер без сборки, поэтому импортам нужно расширение .ts.
    output: { path: 'server/generated', importFileExtension: '.ts' },
    plugins: ['@hey-api/typescript', 'fastify'],
  },
])
