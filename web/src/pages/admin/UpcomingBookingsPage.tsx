import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core'
import type { Booking } from '../../api/generated/index.ts'
import { useBookings, useEventTypes, useSchedule } from '../../api/queries.ts'
import { ErrorState, LoadingState } from '../../components/QueryState.tsx'
import { calendarDateOf, formatDate, formatTimeRange, timeZoneLabel } from '../../lib/time.ts'
import classes from './UpcomingBookingsPage.module.css'

/** Страница владельца: предстоящие записи всех типов встреч в одном списке. */
export function UpcomingBookingsPage() {
  const bookings = useBookings()
  const eventTypes = useEventTypes()
  const schedule = useSchedule()
  // Время встреч показывается в часовом поясе владельца, его сообщает сервер.
  const timeZone = schedule.data?.timeZone

  return (
    <>
      <Title order={1}>Предстоящие встречи</Title>
      <Text c="dimmed" mt="xs">
        Записи гостей по всем типам встреч{timeZone ? `, ${timeZoneLabel(timeZone)}` : ''}.
      </Text>

      <Stack gap="lg" mt="xl">
        {(bookings.isPending || schedule.isPending) && <LoadingState label="Загружаем встречи" />}
        {(bookings.isError || schedule.isError) && (
          <ErrorState
            onRetry={() => {
              void bookings.refetch()
              void schedule.refetch()
            }}
          />
        )}
        {timeZone && bookings.data?.length === 0 && (
          <Text>
            Пока никто не записался.
            {eventTypes.data?.length === 0 && ' Сначала создайте тип встречи.'}
          </Text>
        )}
        {groupByDate(timeZone ? (bookings.data ?? []) : [], timeZone ?? '').map(
          ([date, dayBookings]) => (
            <section key={date} aria-label={formatDate(date)}>
              <Text fw={600} className={classes.date}>
                {formatDate(date)}
              </Text>
              <Stack gap="xs" mt="xs" component="ul" p={0} style={{ listStyle: 'none' }}>
                {dayBookings.map((booking) => (
                  <Card key={booking.id} withBorder padding="md" component="li">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text fw={600}>
                          {formatTimeRange(booking.startTime, booking.endTime, timeZone ?? '')}
                        </Text>
                        <Text size="sm">
                          {booking.guestName}, {booking.guestEmail}
                        </Text>
                        {booking.notes && (
                          <Text size="sm" c="dimmed" mt={4}>
                            {booking.notes}
                          </Text>
                        )}
                      </div>
                      <Badge variant="light">{booking.eventType.title}</Badge>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </section>
          ),
        )}
      </Stack>
    </>
  )
}

/** Группирует записи по календарной дате владельца, сохраняя порядок по времени. */
function groupByDate(bookings: Booking[], timeZone: string): [string, Booking[]][] {
  const groups = new Map<string, Booking[]>()
  for (const booking of bookings) {
    const date = calendarDateOf(booking.startTime, timeZone)
    groups.set(date, [...(groups.get(date) ?? []), booking])
  }
  return [...groups]
}
