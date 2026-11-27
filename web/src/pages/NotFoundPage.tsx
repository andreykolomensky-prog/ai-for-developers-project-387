import { Button, Container, Text, Title } from '@mantine/core'
import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <Container size="sm" py={64}>
      <Title order={1}>Страница не найдена</Title>
      <Text c="dimmed" mt="md">
        Такой страницы нет. Вернитесь на главную и начните запись заново.
      </Text>
      <Button component={Link} to="/" mt="xl">
        На главную
      </Button>
    </Container>
  )
}
