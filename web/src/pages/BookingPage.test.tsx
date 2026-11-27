import { screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { BookingWindow } from '../api/generated/index.ts'
import { fakeApi } from '../test/fake-api.ts'
import { renderApp } from '../test/render.tsx'

const intro = {
  id: 'intro',
  title: 'Знакомство',
  description: 'Короткий звонок',
  durationMinutes: 30,
}

/** Окно записи из 14 дней: сегодня всё уже прошло, дальше по три слота, второй из них занят. */
function bookingWindow(): BookingWindow {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = `2026-03-${String(index + 2).padStart(2, '0')}`
    return {
      date,
      slots: [
        {
          startTime: `${date}T06:00:00.000Z`,
          endTime: `${date}T06:30:00.000Z`,
          available: index > 0,
        },
        { startTime: `${date}T06:30:00.000Z`, endTime: `${date}T07:00:00.000Z`, available: false },
        {
          startTime: `${date}T07:00:00.000Z`,
          endTime: `${date}T07:30:00.000Z`,
          available: index > 0,
        },
      ],
    }
  })
  return { timeZone: 'Europe/Moscow', days }
}

// Понедельник, 2 марта 2026 года, 10:30 по Москве: от этого момента слот считается прошедшим.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-02T07:30:00.000Z') })
})

afterEach(() => {
  vi.useRealTimers()
})

function openBookingPage() {
  fakeApi.eventTypes = [intro]
  fakeApi.bookingWindows = { intro: bookingWindow() }
  renderApp('/book/intro')
}

test('страница записи показывает календарь на 14 дней с числом свободных слотов', async () => {
  openBookingPage()

  expect(await screen.findByRole('heading', { level: 1, name: 'Знакомство' })).toBeVisible()
  expect(screen.getByText(/московское время/)).toBeVisible()

  const days = within(screen.getByRole('group', { name: 'Календарь' })).getAllByRole('button')
  expect(days).toHaveLength(14)
  expect(days[0]).toHaveAccessibleName('понедельник, 2 марта, свободно: 0 слотов')
  expect(days[1]).toHaveAccessibleName('вторник, 3 марта, свободно: 2 слота')
})

test('по умолчанию выбран первый день со свободным слотом, время показано по Москве', async () => {
  openBookingPage()

  const days = within(await screen.findByRole('group', { name: 'Календарь' })).getAllByRole(
    'button',
  )
  expect(days[0]).toHaveAttribute('aria-pressed', 'false')
  expect(days[1]).toHaveAttribute('aria-pressed', 'true')

  expect(screen.getByRole('button', { name: /09:00–09:30/ })).toHaveTextContent('Свободно')
  expect(screen.getByRole('button', { name: /09:00–09:30/ })).toBeEnabled()
})

test('занятый слот помечен и недоступен для выбора', async () => {
  openBookingPage()

  const taken = await screen.findByRole('button', { name: /09:30–10:00/ })

  expect(taken).toHaveTextContent('Занято')
  expect(taken).toBeDisabled()
})

test('гость выбирает день и слот, выбор показан в карточке встречи', async () => {
  const user = userEvent.setup()
  openBookingPage()

  const days = within(await screen.findByRole('group', { name: 'Календарь' })).getAllByRole(
    'button',
  )
  await user.click(days[2]!)
  await user.click(screen.getByRole('button', { name: /09:00–09:30/ }))

  const summary = within(screen.getByRole('region', { name: 'Выбранная встреча' }))
  expect(summary.getByText('среда, 4 марта')).toBeVisible()
  expect(summary.getByText('09:00–09:30')).toBeVisible()
})

test('гость записывается: форма отправляет выбранный слот и данные, затем показано подтверждение', async () => {
  const user = userEvent.setup()
  openBookingPage()

  await user.click(await screen.findByRole('button', { name: /09:00–09:30/ }))
  await user.click(screen.getByRole('button', { name: 'Продолжить' }))
  await user.type(screen.getByLabelText(/Имя/), '  Анна Гостева ')
  await user.type(screen.getByLabelText(/Email/), 'anna@example.com')
  await user.type(screen.getByLabelText(/Заметка/), 'Обсудим запуск')
  await user.click(screen.getByRole('button', { name: 'Записаться' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Вы записаны' })).toBeVisible()
  expect(screen.getByText(/вторник, 3 марта, 09:00–09:30/)).toBeVisible()
  expect(fakeApi.bookingRequests).toEqual([
    {
      eventTypeId: 'intro',
      startTime: '2026-03-03T06:00:00.000Z',
      guestName: 'Анна Гостева',
      guestEmail: 'anna@example.com',
      notes: 'Обсудим запуск',
    },
  ])
})

test('если время заняли, гость видит сообщение и выбирает другой слот, не вводя данные заново', async () => {
  const user = userEvent.setup()
  openBookingPage()
  fakeApi.takenStarts = ['2026-03-03T06:00:00.000Z']

  await user.click(await screen.findByRole('button', { name: /09:00–09:30/ }))
  await user.click(screen.getByRole('button', { name: 'Продолжить' }))
  await user.type(screen.getByLabelText(/Имя/), 'Борис Опоздавший')
  await user.type(screen.getByLabelText(/Email/), 'boris@example.com')
  await user.click(screen.getByRole('button', { name: 'Записаться' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Это время уже занято')
  expect(screen.queryByRole('heading', { name: 'Вы записаны' })).not.toBeInTheDocument()
  // Гость снова на выборе слота, занятое время больше недоступно.
  await waitFor(() => expect(screen.getByRole('button', { name: /09:00–09:30/ })).toBeDisabled())
  expect(screen.getByRole('button', { name: /09:00–09:30/ })).toHaveTextContent('Занято')

  await user.click(screen.getByRole('button', { name: /10:00–10:30/ }))
  await user.click(screen.getByRole('button', { name: 'Продолжить' }))
  expect(screen.getByLabelText(/Имя/)).toHaveValue('Борис Опоздавший')
  expect(screen.getByLabelText(/Email/)).toHaveValue('boris@example.com')
  await user.click(screen.getByRole('button', { name: 'Записаться' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Вы записаны' })).toBeVisible()
})

test('если сервер отклонил email, гость остаётся в форме и видит ошибку у поля', async () => {
  const user = userEvent.setup()
  openBookingPage()
  fakeApi.rejectedEmails = ['anna.@example.com']

  await user.click(await screen.findByRole('button', { name: /09:00–09:30/ }))
  await user.click(screen.getByRole('button', { name: 'Продолжить' }))
  await user.type(screen.getByLabelText(/Имя/), 'Анна Гостева')
  await user.type(screen.getByLabelText(/Email/), 'anna.@example.com')
  await user.click(screen.getByRole('button', { name: 'Записаться' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Проверьте данные формы')
  expect(screen.getByText(/Укажите email в формате/)).toBeVisible()
  // Слот остаётся выбранным, форма не закрывается.
  expect(screen.getByLabelText(/Email/)).toHaveValue('anna.@example.com')
  const summary = within(screen.getByRole('region', { name: 'Выбранная встреча' }))
  expect(summary.getByText('09:00–09:30')).toBeVisible()
})

test('слоты, которые сегодня уже начались, помечены «Прошло», а не «Занято»', async () => {
  const user = userEvent.setup()
  openBookingPage()

  const days = within(await screen.findByRole('group', { name: 'Календарь' })).getAllByRole(
    'button',
  )
  await user.click(days[0]!)

  const morning = screen.getByRole('button', { name: /09:00–09:30/ })
  expect(morning).toHaveTextContent('Прошло')
  expect(morning).toBeDisabled()
})

test('без слота продолжить нельзя, а форма не отправляется без имени и с некорректным email', async () => {
  const user = userEvent.setup()
  openBookingPage()

  const next = await screen.findByRole('button', { name: 'Продолжить' })
  expect(next).toBeDisabled()

  await user.click(screen.getByRole('button', { name: /09:00–09:30/ }))
  await user.click(next)
  await user.type(screen.getByLabelText(/Email/), 'не-почта')
  await user.click(screen.getByRole('button', { name: 'Записаться' }))

  expect(screen.getByText('Укажите имя')).toBeVisible()
  expect(screen.getByText(/Укажите email в формате/)).toBeVisible()
  expect(fakeApi.bookingRequests).toEqual([])
})

test('ссылка на несуществующий тип встречи показывает страницу «не найдено»', async () => {
  renderApp('/book/unknown')

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Страница не найдена' }),
  ).toBeVisible()
})
