import { Anchor, Badge, Card, Container, Group, SimpleGrid, Text, Title } from '@mantine/core'
import { Link } from 'react-router'
import { useEventTypes } from '../api/queries.ts'
import { ErrorState, LoadingState } from '../components/QueryState.tsx'
import { formatDuration } from '../lib/time.ts'
import classes from './EventTypesPage.module.css'

/** Страница записи: гость выбирает тип встречи. */
export function EventTypesPage() {
  const eventTypes = useEventTypes()

  return (
    <Container size="md" py={48}>
      <Title order={1}>Выберите тип встречи</Title>
      <Text c="dimmed" mt="xs">
        Нажмите на карточку, чтобы открыть календарь и выбрать удобный слот.
      </Text>

      <div className={classes.content}>
        {eventTypes.isPending && <LoadingState label="Загружаем типы встреч" />}
        {eventTypes.isError && <ErrorState onRetry={() => void eventTypes.refetch()} />}
        {eventTypes.data?.length === 0 && (
          <Text>
            Владелец пока не создал ни одного типа встречи. Их можно добавить в{' '}
            <Anchor component={Link} to="/admin/event-types">
              админке
            </Anchor>
            .
          </Text>
        )}
        {eventTypes.data && eventTypes.data.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {eventTypes.data.map((eventType) => (
              <Card
                key={eventType.id}
                component={Link}
                to={`/book/${eventType.id}`}
                withBorder
                padding="lg"
                className={classes.card}
              >
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Text fw={600} size="lg">
                    {eventType.title}
                  </Text>
                  <Badge variant="light" color="gray" style={{ flexShrink: 0 }}>
                    {formatDuration(eventType.durationMinutes)}
                  </Badge>
                </Group>
                {eventType.description && (
                  <Text c="dimmed" size="sm" mt="xs">
                    {eventType.description}
                  </Text>
                )}
              </Card>
            ))}
          </SimpleGrid>
        )}
      </div>
    </Container>
  )
}
