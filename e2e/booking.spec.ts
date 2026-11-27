import { expect, type Page, test } from '@playwright/test'

/** Открывает страницу записи типа встречи и выбирает день окна записи по номеру (0 это сегодня). */
async function openDay(page: Page, eventTypeTitle: string, dayIndex: number) {
  await page.goto('/book')
  await page.getByRole('link', { name: new RegExp(eventTypeTitle) }).click()
  await expect(page.getByRole('heading', { level: 1, name: eventTypeTitle })).toBeVisible()
  await page.getByRole('group', { name: 'Календарь' }).getByRole('button').nth(dayIndex).click()
}

async function fillGuestDetails(page: Page, name: string, email: string, notes?: string) {
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await page.getByLabel('Имя').fill(name)
  await page.getByLabel('Email').fill(email)
  if (notes) {
    await page.getByLabel('Заметка').fill(notes)
  }
  await page.getByRole('button', { name: 'Записаться' }).click()
}

test('гость записывается на свободный слот, владелец видит встречу, слот становится занятым', async ({
  page,
}) => {
  // Гость приходит на главную и переходит к записи.
  await page.goto('/')
  await page.getByRole('main').getByRole('link', { name: 'Записаться' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Выберите тип встречи' })).toBeVisible()

  // Выбирает тип встречи, завтрашний день и свободный слот.
  await page.getByRole('link', { name: /Встреча 30 минут/ }).click()
  const calendar = page.getByRole('group', { name: 'Календарь' })
  await expect(calendar.getByRole('button')).toHaveCount(14)
  await calendar.getByRole('button').nth(1).click()

  const slot = page.getByRole('button', { name: /10:00–10:30/ })
  await expect(slot).toContainText('Свободно')
  await slot.click()

  await fillGuestDetails(page, 'Анна Гостева', 'anna@example.com', 'Обсудим запуск проекта')

  // Видит подтверждение.
  await expect(page.getByRole('heading', { level: 1, name: 'Вы записаны' })).toBeVisible()
  await expect(page.getByRole('main')).toContainText('Встреча 30 минут')
  await expect(page.getByRole('main')).toContainText('10:00–10:30')

  // Владелец видит встречу в общем списке.
  await page.getByRole('link', { name: 'Админка' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Предстоящие встречи' })).toBeVisible()
  const booking = page.getByRole('listitem').filter({ hasText: 'Анна Гостева' })
  await expect(booking).toContainText('10:00–10:30')
  await expect(booking).toContainText('anna@example.com')
  await expect(booking).toContainText('Встреча 30 минут')
  await expect(booking).toContainText('Обсудим запуск проекта')

  // Занятое время больше не предлагается, в том числе для другого типа встречи.
  await openDay(page, 'Встреча 30 минут', 1)
  await expect(page.getByRole('button', { name: /10:00–10:30/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /10:00–10:30/ })).toContainText('Занято')

  await openDay(page, 'Встреча 15 минут', 1)
  await expect(page.getByRole('button', { name: /10:00–10:15/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /10:15–10:30/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /10:30–10:45/ })).toBeEnabled()
})

test('если слот заняли, пока гость заполнял форму, он видит понятное сообщение и выбирает другое время', async ({
  page,
  request,
}) => {
  await openDay(page, 'Встреча 30 минут', 2)
  await page.getByRole('button', { name: /11:00–11:30/ }).click()
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await page.getByLabel('Имя').fill('Борис Опоздавший')
  await page.getByLabel('Email').fill('boris@example.com')

  // Пока форма открыта, другой гость занимает пересекающееся время коротким типом встречи.
  const windowResponse = await request.get('/api/event-types/meeting-15/booking-window')
  const bookingWindow = (await windowResponse.json()) as {
    days: { slots: { startTime: string }[] }[]
  }
  // Слоты на 15 минут идут с 09:00, девятый по счёту начинается в 11:00.
  const overlappingStart = bookingWindow.days[2]!.slots[8]!.startTime
  const rival = await request.post('/api/bookings', {
    data: {
      eventTypeId: 'meeting-15',
      startTime: overlappingStart,
      guestName: 'Вера Первая',
      guestEmail: 'vera@example.com',
    },
  })
  expect(rival.status()).toBe(201)

  await page.getByRole('button', { name: 'Записаться' }).click()

  // Сервер отклоняет запись, гость видит причину и возвращается к выбору слота.
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Это время уже занято')
  await expect(page.getByRole('button', { name: /11:00–11:30/ })).toBeDisabled()
  await expect(page.getByRole('heading', { name: 'Вы записаны' })).toHaveCount(0)

  // Данные формы сохранились: достаточно выбрать другой слот.
  await page.getByRole('button', { name: /11:30–12:00/ }).click()
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await expect(page.getByLabel('Имя')).toHaveValue('Борис Опоздавший')
  await page.getByRole('button', { name: 'Записаться' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Вы записаны' })).toBeVisible()

  // У владельца обе встречи, отклонённой записи нет.
  await page.goto('/admin')
  await expect(page.getByRole('listitem').filter({ hasText: 'Вера Первая' })).toContainText(
    '11:00–11:15',
  )
  await expect(page.getByRole('listitem').filter({ hasText: 'Борис Опоздавший' })).toContainText(
    '11:30–12:00',
  )
  await expect(page.getByRole('listitem').filter({ hasText: 'Борис Опоздавший' })).toHaveCount(1)
})

test('владелец создаёт тип встречи, и гость записывается на него', async ({ page }) => {
  await page.goto('/admin')
  await page.getByRole('link', { name: 'Типы встреч' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Типы встреч' })).toBeVisible()

  await page.getByLabel('Название').fill('Консультация')
  await page.getByLabel('Идентификатор').fill('consult-60')
  await page.getByLabel('Длительность, минут').fill('60')
  await page.getByLabel('Описание').fill('Подробный разбор задачи')
  await page.getByRole('button', { name: 'Создать тип встречи' }).click()

  await expect(page.getByRole('status')).toContainText('Тип встречи «Консультация» создан')
  await expect(page.getByRole('listitem').filter({ hasText: 'consult-60' })).toContainText('60 мин')

  // Повторный идентификатор отклоняется с понятной подсказкой.
  await page.getByLabel('Название').fill('Другая консультация')
  await page.getByLabel('Идентификатор').fill('consult-60')
  await page.getByRole('button', { name: 'Создать тип встречи' }).click()
  await expect(page.getByText('Такой идентификатор уже занят')).toBeVisible()

  // Гость видит новый тип и записывается: слот длится 60 минут.
  await openDay(page, 'Консультация', 3)
  await page.getByRole('button', { name: /14:00–15:00/ }).click()
  await fillGuestDetails(page, 'Глеб Новый', 'gleb@example.com')
  await expect(page.getByRole('heading', { level: 1, name: 'Вы записаны' })).toBeVisible()

  // Часовая встреча закрывает оба получасовых слота другого типа.
  await openDay(page, 'Встреча 30 минут', 3)
  await expect(page.getByRole('button', { name: /14:00–14:30/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /14:30–15:00/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /15:00–15:30/ })).toBeEnabled()
})
