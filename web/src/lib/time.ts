/** Время начала слота в часовом поясе владельца, например `10:00`. */
export function formatTime(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone }).format(
    new Date(instant),
  )
}

/** Интервал слота в часовом поясе владельца, например `10:00–10:30`. */
export function formatTimeRange(start: string, end: string, timeZone: string): string {
  return `${formatTime(start, timeZone)}–${formatTime(end, timeZone)}`
}

// Календарная дата из API уже относится к часовому поясу владельца,
// поэтому форматируем её как есть, без пересчёта.
const calendarDate = (date: string) => new Date(`${date}T00:00:00Z`)

function formatCalendarDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('ru-RU', { ...options, timeZone: 'UTC' }).format(
    calendarDate(date),
  )
}

/** Дата целиком, например `вторник, 3 марта`. */
export function formatDate(date: string): string {
  return formatCalendarDate(date, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Короткий день недели, например `вт`. */
export function formatWeekday(date: string): string {
  return formatCalendarDate(date, { weekday: 'short' })
}

/** Число и месяц, например `3 мар.`. */
export function formatDayAndMonth(date: string): string {
  return formatCalendarDate(date, { day: 'numeric', month: 'short' })
}

/** Календарная дата момента времени в заданном часовом поясе, `ГГГГ-ММ-ДД`. */
export function calendarDateOf(instant: string, timeZone: string): string {
  // Локаль en-CA даёт дату в формате ISO.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(instant))
}

/** Название часового пояса для подписи, например `Москва`. */
export function timeZoneLabel(timeZone: string): string {
  return timeZone === 'Europe/Moscow' ? 'московское время' : `часовой пояс ${timeZone}`
}

/** Длительность встречи, например `30 мин`. */
export function formatDuration(minutes: number): string {
  return `${minutes} мин`
}

/** Форма слова «слот» для числа: 1 слот, 2 слота, 5 слотов. */
export function pluralizeSlots(count: number): string {
  const rule = new Intl.PluralRules('ru-RU').select(count)
  const word = rule === 'one' ? 'слот' : rule === 'few' ? 'слота' : 'слотов'
  return `${count} ${word}`
}
