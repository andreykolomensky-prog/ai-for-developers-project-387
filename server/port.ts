/**
 * Порт из переменной окружения `PORT`. Пустое значение означает порт по
 * умолчанию, а нечисловое считается ошибкой конфигурации: молча слушать
 * случайный порт хуже, чем не запуститься.
 */
export function resolvePort(value: string | undefined, fallback = 3000): number {
  if (value === undefined || value.trim() === '') {
    return fallback
  }
  const port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Некорректный PORT «${value}»: ожидается целое число от 0 до 65535`)
  }
  return port
}
