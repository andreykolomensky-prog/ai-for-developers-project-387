import { expect, test } from 'vitest'
import { resolvePort } from '../server/port.ts'

test('порт берётся из PORT', () => {
  expect(resolvePort('8080')).toBe(8080)
})

test.each([undefined, '', '  '])(
  'без значения PORT (%j) используется порт по умолчанию',
  (value) => {
    expect(resolvePort(value)).toBe(3000)
  },
)

test.each(['3000a', 'abc', '-1', '70000', '80.5'])(
  'некорректный PORT %j считается ошибкой',
  (value) => {
    expect(() => resolvePort(value)).toThrow(/Некорректный PORT/)
  },
)
