import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 4173)

// Браузерные тесты работают с настоящим сервером и собранным фронтендом:
// ответы API не подменяются. Данные сервер хранит в памяти, поэтому тесты
// идут по очереди и занимают разные дни окна записи.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node server/main.ts',
    env: { PORT: String(port), HOST: '127.0.0.1' },
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
  },
  outputDir: 'test-results',
})
