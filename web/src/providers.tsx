import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { theme } from './theme.ts'

type Props = {
  children: ReactNode
  /** В тестах отключаем анимации и повторные запросы. */
  testMode?: boolean
}

export function Providers({ children, testMode = false }: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: testMode ? false : 1, refetchOnWindowFocus: false },
        },
      }),
  )

  return (
    <MantineProvider theme={theme} env={testMode ? 'test' : 'default'}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MantineProvider>
  )
}
