import { Badge, Box, Button, Container, List, Paper, SimpleGrid, Text, Title } from '@mantine/core'
import { IconArrowRight } from '@tabler/icons-react'
import { Link } from 'react-router'
import classes from './HomePage.module.css'

export function HomePage() {
  return (
    <Box className={classes.hero}>
      <Container size="lg" py={64}>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={48}>
          <div>
            <Badge variant="white" color="gray" radius="sm">
              Быстрая запись на звонок
            </Badge>
            <Title order={1} mt="md" fz={44}>
              Запись на звонок
            </Title>
            <Text c="dimmed" mt="md" size="lg" maw={460}>
              Забронируйте встречу за минуту: выберите тип встречи и удобное время.
            </Text>
            <Button
              component={Link}
              to="/book"
              size="md"
              mt="xl"
              rightSection={<IconArrowRight size={18} aria-hidden />}
            >
              Записаться
            </Button>
          </div>
          <Paper
            withBorder
            shadow="sm"
            p="xl"
            radius="lg"
            component="section"
            aria-labelledby="how"
          >
            <Title order={2} size="h3" id="how">
              Как это работает
            </Title>
            <List type="ordered" spacing="sm" mt="md" c="dimmed">
              <List.Item>Выберите тип встречи: у каждого своя длительность.</List.Item>
              <List.Item>Найдите свободный слот в ближайшие 14 дней.</List.Item>
              <List.Item>Оставьте имя и email, и встреча появится в календаре владельца.</List.Item>
            </List>
          </Paper>
        </SimpleGrid>
      </Container>
    </Box>
  )
}
