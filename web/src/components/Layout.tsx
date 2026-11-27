import { Anchor, AppShell, Container, Group, Text } from '@mantine/core'
import { IconCalendarEvent } from '@tabler/icons-react'
import { Link, NavLink, Outlet } from 'react-router'
import classes from './Layout.module.css'

export function Layout() {
  return (
    <AppShell header={{ height: 56 }} padding={0}>
      <AppShell.Header>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between">
            <Anchor component={Link} to="/" underline="never" c="inherit">
              <Group gap="xs">
                <IconCalendarEvent size={22} color="var(--mantine-color-orange-6)" aria-hidden />
                <Text fw={700}>Запись на звонок</Text>
              </Group>
            </Anchor>
            <Group component="nav" gap="xs" aria-label="Основная навигация">
              <NavLink to="/book" className={classes.link}>
                Записаться
              </NavLink>
              <NavLink to="/admin" className={classes.link}>
                Админка
              </NavLink>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
