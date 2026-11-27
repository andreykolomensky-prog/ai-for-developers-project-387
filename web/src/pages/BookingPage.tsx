import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { isEmail, isNotEmpty, useForm } from '@mantine/form'
import { IconCircleCheck } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import type { Booking, BookingWindow, EventType, Slot } from '../api/generated/index.ts'
import {
  type ApiFailure,
  useBookingWindow,
  useCreateBooking,
  useEventType,
} from '../api/queries.ts'
import { ErrorState, LoadingState } from '../components/QueryState.tsx'
import {
  calendarDateOf,
  formatDate,
  formatDayAndMonth,
  formatDuration,
  formatTimeRange,
  formatWeekday,
  pluralizeSlots,
  timeZoneLabel,
} from '../lib/time.ts'
import classes from './BookingPage.module.css'
import { NotFoundPage } from './NotFoundPage.tsx'

/** Страница записи на выбранный тип встречи: день, слот, данные гостя, подтверждение. */
export function BookingPage() {
  const { eventTypeId = '' } = useParams()
  const eventType = useEventType(eventTypeId)
  const bookingWindow = useBookingWindow(eventTypeId, Boolean(eventType.data))

  if (eventType.data === null) {
    return <NotFoundPage />
  }

  return (
    <Container size="lg" py={48}>
      {(eventType.isPending || bookingWindow.isLoading) && (
        <LoadingState label="Загружаем календарь" />
      )}
      {(eventType.isError || bookingWindow.isError) && (
        <ErrorState
          onRetry={() => {
            void eventType.refetch()
            void bookingWindow.refetch()
          }}
        />
      )}
      {eventType.data && bookingWindow.data && (
        <BookingFlow
          eventType={eventType.data}
          bookingWindow={bookingWindow.data}
          fetchedAt={bookingWindow.dataUpdatedAt}
        />
      )}
    </Container>
  )
}

type FlowProps = {
  eventType: EventType
  bookingWindow: BookingWindow
  /** Момент, когда получено окно записи: относительно него слот считается прошедшим. */
  fetchedAt: number
}

type GuestDetails = {
  guestName: string
  guestEmail: string
  guestPhone: string
  notes: string
}

/** Сообщения для полей формы, которые сервер отклонил по контракту. */
const fieldMessages: Record<keyof GuestDetails, string> = {
  guestName: 'Укажите имя',
  guestEmail: 'Укажите email в формате name@example.com',
  guestPhone:
    'Телефон должен содержать от 5 до 30 символов, хотя бы одну цифру и состоять только из цифр, +, пробелов, дефисов и скобок',
  notes: 'Заметка слишком длинная',
}

function BookingFlow({ eventType, bookingWindow, fetchedAt }: FlowProps) {
  const { timeZone, days } = bookingWindow
  const firstOpenDay = days.find((day) => day.slots.some((slot) => slot.available)) ?? days[0]

  const [selectedDate, setSelectedDate] = useState(firstOpenDay?.date ?? '')
  const [selectedStart, setSelectedStart] = useState<string | null>(null)
  const [step, setStep] = useState<'slot' | 'details'>('slot')
  const [failure, setFailure] = useState<ApiFailure | null>(null)
  const [confirmed, setConfirmed] = useState<Booking | null>(null)
  const createBooking = useCreateBooking()

  const form = useForm<GuestDetails>({
    mode: 'uncontrolled',
    initialValues: { guestName: '', guestEmail: '', guestPhone: '', notes: '' },
    validate: {
      guestName: isNotEmpty('Укажите имя'),
      guestEmail: isEmail('Укажите email в формате name@example.com'),
    },
    transformValues: (values) => ({
      guestName: values.guestName.trim(),
      guestEmail: values.guestEmail.trim(),
      guestPhone: values.guestPhone.trim(),
      notes: values.notes.trim(),
    }),
  })

  if (confirmed) {
    return <Confirmation booking={confirmed} timeZone={timeZone} />
  }

  // Окно записи перечитывается, поэтому выбор сверяется с ним заново: день мог выйти
  // из окна, а слот мог стать занятым.
  const selectedDay = days.find((day) => day.date === selectedDate) ?? firstOpenDay
  const activeDate = selectedDay?.date ?? ''
  const selectedSlot = selectedDay?.slots.find(
    (slot) => slot.startTime === selectedStart && slot.available,
  )
  const showDetails = step === 'details' && selectedSlot !== undefined

  const selectDay = (date: string) => {
    setSelectedDate(date)
    setSelectedStart(null)
    setStep('slot')
  }

  const submit = async (details: GuestDetails) => {
    if (!selectedSlot) {
      return
    }
    setFailure(null)
    const result = await createBooking.mutateAsync({
      eventTypeId: eventType.id,
      startTime: selectedSlot.startTime,
      guestName: details.guestName,
      guestEmail: details.guestEmail,
      ...(details.guestPhone ? { guestPhone: details.guestPhone } : {}),
      ...(details.notes ? { notes: details.notes } : {}),
    })
    if (result.ok) {
      setConfirmed(result.booking)
      return
    }
    setFailure(result.failure)
    const issues = result.failure.issues ?? []
    for (const issue of issues) {
      if (issue.field in fieldMessages) {
        form.setFieldError(issue.field, fieldMessages[issue.field as keyof GuestDetails])
      }
    }
    if (isSlotRejected(result.failure)) {
      // Слот больше недоступен: возвращаем гостя к выбору времени, данные формы сохраняются.
      setSelectedStart(null)
      setStep('slot')
    }
  }

  return (
    <>
      <Title order={1}>{eventType.title}</Title>
      <Text c="dimmed" mt="xs">
        Время указано в часовом поясе владельца: {timeZoneLabel(timeZone)}.
      </Text>

      {failure && (
        <Alert color="red" mt="lg" role="alert" title={failureTitle(failure)}>
          {failure.message}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mt="lg" className={classes.columns}>
        <Card withBorder padding="lg" component="section" aria-label="Выбранная встреча">
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Text fw={600}>{eventType.title}</Text>
            <Badge variant="light" color="gray" style={{ flexShrink: 0 }}>
              {formatDuration(eventType.durationMinutes)}
            </Badge>
          </Group>
          {eventType.description && (
            <Text c="dimmed" size="sm" mt="xs">
              {eventType.description}
            </Text>
          )}
          <Stack gap="xs" mt="md">
            <Summary label="Выбранная дата" value={activeDate ? formatDate(activeDate) : '—'} />
            <Summary
              label="Выбранное время"
              value={
                selectedSlot
                  ? formatTimeRange(selectedSlot.startTime, selectedSlot.endTime, timeZone)
                  : 'Время не выбрано'
              }
            />
          </Stack>
        </Card>

        <Card withBorder padding="lg" component="section" aria-labelledby="calendar-title">
          <Text fw={600} id="calendar-title">
            Календарь
          </Text>
          <Text c="dimmed" size="xs" mt={4}>
            Запись открыта на 14 дней вперёд
          </Text>
          <div className={classes.days} role="group" aria-labelledby="calendar-title">
            {days.map((day) => {
              const free = day.slots.filter((slot) => slot.available).length
              return (
                <button
                  key={day.date}
                  type="button"
                  className={classes.day}
                  aria-pressed={day.date === activeDate}
                  aria-label={`${formatDate(day.date)}, свободно: ${pluralizeSlots(free)}`}
                  data-empty={free === 0 || undefined}
                  onClick={() => selectDay(day.date)}
                >
                  <span className={classes.weekday}>{formatWeekday(day.date)}</span>
                  <span className={classes.dayNumber}>{formatDayAndMonth(day.date)}</span>
                  <span className={classes.free}>{free} св.</span>
                </button>
              )
            })}
          </div>
        </Card>

        {!showDetails ? (
          <Card withBorder padding="lg" component="section" aria-labelledby="slots-title">
            <Text fw={600} id="slots-title">
              Слоты
            </Text>
            <Text c="dimmed" size="xs" mt={4}>
              {activeDate ? formatDate(activeDate) : 'Выберите день'}
            </Text>
            <SlotList
              slots={selectedDay?.slots ?? []}
              timeZone={timeZone}
              fetchedAt={fetchedAt}
              selectedStart={selectedSlot?.startTime ?? null}
              onSelect={(slot) => {
                setSelectedStart(slot.startTime)
                setFailure(null)
              }}
            />
            <Group mt="md" grow>
              <Button component={Link} to="/book" variant="default">
                Назад
              </Button>
              <Button disabled={!selectedSlot} onClick={() => setStep('details')}>
                Продолжить
              </Button>
            </Group>
          </Card>
        ) : (
          <Card withBorder padding="lg" component="section" aria-labelledby="details-title">
            <Text fw={600} id="details-title">
              Ваши данные
            </Text>
            <form onSubmit={form.onSubmit((values) => void submit(values))} noValidate>
              <Stack gap="sm" mt="sm">
                <TextInput
                  label="Имя"
                  placeholder="Как к вам обращаться"
                  autoComplete="name"
                  maxLength={80}
                  withAsterisk
                  key={form.key('guestName')}
                  {...form.getInputProps('guestName')}
                />
                <TextInput
                  label="Email"
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  maxLength={254}
                  withAsterisk
                  key={form.key('guestEmail')}
                  {...form.getInputProps('guestEmail')}
                />
                <TextInput
                  label="Телефон"
                  description="Необязательно: чтобы владелец мог позвонить"
                  placeholder="+7 999 123-45-67"
                  autoComplete="tel"
                  inputMode="tel"
                  key={form.key('guestPhone')}
                  {...form.getInputProps('guestPhone')}
                />
                <Textarea
                  label="Заметка"
                  description="Необязательно: о чём хотите поговорить"
                  maxLength={500}
                  autosize
                  minRows={2}
                  key={form.key('notes')}
                  {...form.getInputProps('notes')}
                />
              </Stack>
              <Group mt="md" grow>
                <Button variant="default" onClick={() => setStep('slot')}>
                  Назад
                </Button>
                <Button type="submit" loading={createBooking.isPending}>
                  Записаться
                </Button>
              </Group>
            </form>
          </Card>
        )}
      </SimpleGrid>
    </>
  )
}

/** Отказ относится к выбранному времени: оно занято или не является свободным слотом. */
function isSlotRejected(failure: ApiFailure): boolean {
  return (
    failure.code === 'slot_taken' ||
    (failure.issues ?? []).some((issue) => issue.field === 'startTime')
  )
}

function failureTitle(failure: ApiFailure): string {
  switch (failure.code) {
    case 'slot_taken':
      return 'Это время уже занято'
    case 'validation_error':
      return isSlotRejected(failure) ? 'На это время записаться нельзя' : 'Проверьте данные формы'
    case 'not_found':
      return 'Тип встречи не найден'
    default:
      return 'Не удалось создать запись'
  }
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className={classes.summary}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500}>
        {value}
      </Text>
    </div>
  )
}

type SlotListProps = {
  slots: Slot[]
  timeZone: string
  fetchedAt: number
  selectedStart: string | null
  onSelect: (slot: Slot) => void
}

/** Подпись слота: свободен, занят записью или уже начался. */
function slotStatus(slot: Slot, fetchedAt: number): string {
  if (slot.available) {
    return 'Свободно'
  }
  return Date.parse(slot.startTime) <= fetchedAt ? 'Прошло' : 'Занято'
}

function SlotList({ slots, timeZone, fetchedAt, selectedStart, onSelect }: SlotListProps) {
  if (slots.length === 0) {
    return (
      <Text size="sm" c="dimmed" mt="md">
        В этот день слотов нет.
      </Text>
    )
  }

  return (
    <ul className={classes.slots} aria-labelledby="slots-title">
      {slots.map((slot) => (
        <li key={slot.startTime}>
          <button
            type="button"
            className={classes.slot}
            disabled={!slot.available}
            aria-pressed={slot.startTime === selectedStart}
            onClick={() => onSelect(slot)}
          >
            <span>{formatTimeRange(slot.startTime, slot.endTime, timeZone)}</span>
            <span className={classes.slotStatus}>{slotStatus(slot, fetchedAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Confirmation({ booking, timeZone }: { booking: Booking; timeZone: string }) {
  return (
    <Card withBorder padding="xl" maw={560} mx="auto" component="section">
      <Group gap="sm">
        <IconCircleCheck size={32} color="var(--mantine-color-green-6)" aria-hidden />
        <Title order={1} size="h2">
          Вы записаны
        </Title>
      </Group>
      <Text mt="md">
        {booking.guestName}, встреча «{booking.eventType.title}» подтверждена.
      </Text>
      <Stack gap="xs" mt="md">
        <Summary
          label="Когда"
          value={`${formatDate(calendarDateOf(booking.startTime, timeZone))}, ${formatTimeRange(booking.startTime, booking.endTime, timeZone)} (${timeZoneLabel(timeZone)})`}
        />
        <Summary label="Email для связи" value={booking.guestEmail} />
        {booking.guestPhone && <Summary label="Телефон для связи" value={booking.guestPhone} />}
        {booking.notes && <Summary label="Заметка" value={booking.notes} />}
      </Stack>
      <Group mt="xl">
        <Button component={Link} to="/book">
          Записаться ещё
        </Button>
        <Button component={Link} to="/" variant="default">
          На главную
        </Button>
      </Group>
    </Card>
  )
}
