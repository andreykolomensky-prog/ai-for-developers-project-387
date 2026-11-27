import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { client } from '../api/generated/client.gen.ts'
import { fakeFetch, resetFakeApi } from './fake-api.ts'

afterEach(() => {
  cleanup()
  resetFakeApi()
})

// jsdom не реализует эти API, а компоненты Mantine на них опираются.
window.HTMLElement.prototype.scrollIntoView = () => {}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver

if (!document.fonts) {
  Object.defineProperty(document, 'fonts', {
    value: { addEventListener: () => {}, removeEventListener: () => {} },
  })
}

// Компонентные тесты работают без сервера: SDK получает данные из fakeApi.
// Сценарий бронирования с настоящим сервером проверяют браузерные тесты.
client.setConfig({ baseUrl: 'http://localhost', fetch: fakeFetch })
