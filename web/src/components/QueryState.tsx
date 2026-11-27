import { Alert, Button, Center, Loader } from '@mantine/core'

export function LoadingState({ label }: { label: string }) {
  return (
    <Center py="xl">
      <Loader aria-label={label} />
    </Center>
  )
}

type ErrorStateProps = {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Alert color="red" title="Не удалось загрузить данные" role="alert">
      {message ?? 'Проверьте соединение и попробуйте ещё раз.'}
      {onRetry && (
        <Button variant="light" color="red" size="xs" mt="sm" display="block" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </Alert>
  )
}
