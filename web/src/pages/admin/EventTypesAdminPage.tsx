import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { isInRange, matches, useForm } from '@mantine/form'
import { useState } from 'react'
import type { EventType } from '../../api/generated/index.ts'
import { useCreateEventType, useEventTypes } from '../../api/queries.ts'
import { ErrorState, LoadingState } from '../../components/QueryState.tsx'
import { formatDuration } from '../../lib/time.ts'

/** Страница владельца: список типов встреч и форма создания нового. */
export function EventTypesAdminPage() {
  const eventTypes = useEventTypes()

  return (
    <>
      <Title order={1}>Типы встреч</Title>
      <Text c="dimmed" mt="xs">
        Гость выбирает тип встречи на странице записи. Слот длится столько же, сколько встреча.
      </Text>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mt="xl" style={{ alignItems: 'start' }}>
        <section aria-labelledby="existing-title">
          <Text fw={600} id="existing-title">
            Созданные типы
          </Text>
          <Stack gap="xs" mt="sm">
            {eventTypes.isPending && <LoadingState label="Загружаем типы встреч" />}
            {eventTypes.isError && <ErrorState onRetry={() => void eventTypes.refetch()} />}
            {eventTypes.data?.length === 0 && <Text c="dimmed">Типов встреч пока нет.</Text>}
            <Stack gap="xs" component="ul" p={0} m={0} style={{ listStyle: 'none' }}>
              {eventTypes.data?.map((eventType) => (
                <Card key={eventType.id} withBorder padding="md" component="li">
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <div>
                      <Text fw={600}>{eventType.title}</Text>
                      <Text size="xs" c="dimmed">
                        {eventType.id}
                      </Text>
                    </div>
                    <Badge variant="light" color="gray" style={{ flexShrink: 0 }}>
                      {formatDuration(eventType.durationMinutes)}
                    </Badge>
                  </Group>
                  {eventType.description && (
                    <Text size="sm" c="dimmed" mt="xs">
                      {eventType.description}
                    </Text>
                  )}
                </Card>
              ))}
            </Stack>
          </Stack>
        </section>

        <CreateEventTypeForm />
      </SimpleGrid>
    </>
  )
}

const initialValues: EventType = { id: '', title: '', description: '', durationMinutes: 30 }

function CreateEventTypeForm() {
  const createEventType = useCreateEventType()
  const [created, setCreated] = useState<EventType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<EventType>({
    mode: 'uncontrolled',
    initialValues,
    validate: {
      id: matches(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        'Только латинские буквы в нижнем регистре, цифры и дефис, например intro-30',
      ),
      title: (value) => (value.trim() === '' ? 'Укажите название' : null),
      durationMinutes: isInRange({ min: 5, max: 480 }, 'От 5 до 480 минут'),
    },
    transformValues: (values) => ({
      ...values,
      id: values.id.trim(),
      title: values.title.trim(),
      description: values.description.trim(),
    }),
  })

  const submit = async (values: EventType) => {
    setCreated(null)
    setError(null)
    const result = await createEventType.mutateAsync(values)
    if (result.ok) {
      setCreated(result.eventType)
      form.reset()
      return
    }
    if (result.failure.code === 'event_type_exists') {
      form.setFieldError('id', 'Такой идентификатор уже занят')
      return
    }
    for (const issue of result.failure.issues ?? []) {
      form.setFieldError(issue.field, issue.message)
    }
    setError(result.failure.message)
  }

  return (
    <Card withBorder padding="lg" component="section" aria-labelledby="create-title">
      <Text fw={600} id="create-title">
        Новый тип встречи
      </Text>
      <form onSubmit={form.onSubmit((values) => void submit(values))} noValidate>
        <Stack gap="sm" mt="sm">
          <TextInput
            label="Название"
            placeholder="Встреча 30 минут"
            maxLength={80}
            withAsterisk
            key={form.key('title')}
            {...form.getInputProps('title')}
          />
          <TextInput
            label="Идентификатор"
            description="Попадает в адрес страницы записи"
            placeholder="meeting-30"
            maxLength={40}
            withAsterisk
            key={form.key('id')}
            {...form.getInputProps('id')}
          />
          <NumberInput
            label="Длительность, минут"
            min={5}
            max={480}
            step={5}
            allowDecimal={false}
            withAsterisk
            key={form.key('durationMinutes')}
            {...form.getInputProps('durationMinutes')}
          />
          <Textarea
            label="Описание"
            description="Необязательно: что гость увидит на карточке"
            maxLength={500}
            autosize
            minRows={2}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />
          {created && (
            <Alert color="green" role="status">
              Тип встречи «{created.title}» создан.
            </Alert>
          )}
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}
          <Button type="submit" loading={createEventType.isPending}>
            Создать тип встречи
          </Button>
        </Stack>
      </form>
    </Card>
  )
}
