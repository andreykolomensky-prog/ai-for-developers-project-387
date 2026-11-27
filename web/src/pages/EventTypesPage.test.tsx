import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { fakeApi } from '../test/fake-api.ts'
import { renderApp } from '../test/render.tsx'

test('страница записи показывает типы встреч с описанием и длительностью', async () => {
  fakeApi.eventTypes = [
    { id: 'intro', title: 'Знакомство', description: 'Короткий звонок', durationMinutes: 15 },
    { id: 'review', title: 'Разбор задачи', description: '', durationMinutes: 45 },
  ]
  renderApp('/book')

  const main = within(screen.getByRole('main'))
  const cards = await main.findAllByRole('link')

  expect(cards).toHaveLength(2)
  expect(within(cards[0]!).getByText('Знакомство')).toBeVisible()
  expect(within(cards[0]!).getByText('Короткий звонок')).toBeVisible()
  expect(within(cards[0]!).getByText('15 мин')).toBeVisible()
  expect(cards[0]).toHaveAttribute('href', '/book/intro')
  expect(within(cards[1]!).getByText('Разбор задачи')).toBeVisible()
  expect(within(cards[1]!).getByText('45 мин')).toBeVisible()
  expect(cards[1]).toHaveAttribute('href', '/book/review')
})

test('страница записи без типов встреч подсказывает, где их создать', async () => {
  renderApp('/book')

  expect(await screen.findByText(/пока не создал ни одного типа встречи/i)).toBeVisible()
  expect(screen.getByRole('link', { name: 'админке' })).toHaveAttribute(
    'href',
    '/admin/event-types',
  )
})
