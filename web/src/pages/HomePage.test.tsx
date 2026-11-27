import { screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { renderApp } from '../test/render.tsx'

test('главная страница рассказывает про сервис', () => {
  renderApp('/')

  expect(screen.getByRole('heading', { level: 1, name: 'Запись на звонок' })).toBeVisible()
  expect(screen.getByText(/выберите тип встречи и удобное время/i)).toBeVisible()
  expect(screen.getByRole('heading', { level: 2, name: 'Как это работает' })).toBeVisible()
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
})

test('кнопка «Записаться» ведёт на страницу записи', async () => {
  const user = userEvent.setup()
  renderApp('/')

  const cta = within(screen.getByRole('main')).getByRole('link', { name: 'Записаться' })
  expect(cta).toHaveAttribute('href', '/book')

  await user.click(cta)

  expect(screen.getByRole('heading', { level: 1, name: 'Выберите тип встречи' })).toBeVisible()
})

test('ссылка «Записаться» в шапке ведёт на страницу записи', async () => {
  const user = userEvent.setup()
  renderApp('/')

  const navigation = screen.getByRole('navigation', { name: 'Основная навигация' })
  await user.click(within(navigation).getByRole('link', { name: 'Записаться' }))

  expect(screen.getByRole('heading', { level: 1, name: 'Выберите тип встречи' })).toBeVisible()
})

test('со страницы записи можно вернуться на главную по логотипу', async () => {
  const user = userEvent.setup()
  renderApp('/book')

  await user.click(screen.getByRole('link', { name: 'Запись на звонок' }))

  expect(screen.getByRole('heading', { level: 1, name: 'Запись на звонок' })).toBeVisible()
})

test('неизвестный адрес показывает страницу «не найдено»', () => {
  renderApp('/no-such-page')

  expect(screen.getByRole('heading', { level: 1, name: 'Страница не найдена' })).toBeVisible()
})
