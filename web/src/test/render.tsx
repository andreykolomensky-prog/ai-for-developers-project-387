import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { App } from '../App.tsx'
import { Providers } from '../providers.tsx'

/** Рендерит приложение целиком на указанном адресе, как его увидит пользователь. */
export function renderApp(path = '/') {
  return render(
    <Providers testMode>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Providers>,
  )
}
