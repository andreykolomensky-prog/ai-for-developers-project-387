import { Container, Group, Text } from '@mantine/core'
import { NavLink, Outlet } from 'react-router'
import classes from './AdminLayout.module.css'

/** Админка: раздел владельца со встречами и типами встреч. */
export function AdminLayout() {
  return (
    <Container size="lg" py={48}>
      <Text size="sm" c="dimmed">
        Админка владельца
      </Text>
      <Group component="nav" gap="xs" mt="xs" aria-label="Разделы админки">
        <NavLink to="/admin" end className={classes.tab}>
          Предстоящие встречи
        </NavLink>
        <NavLink to="/admin/event-types" className={classes.tab}>
          Типы встреч
        </NavLink>
      </Group>
      <div className={classes.content}>
        <Outlet />
      </div>
    </Container>
  )
}
