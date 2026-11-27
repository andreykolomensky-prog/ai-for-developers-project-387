import type { Schedule } from './generated/types.gen.ts'

export type { Schedule }

export const defaultSchedule: Schedule = {
  timeZone: 'Europe/Moscow',
  workDayStart: '09:00',
  workDayEnd: '18:00',
  windowDays: 14,
}

/** Полуинтервал `[start, end)` в миллисекундах эпохи. */
export type Interval = {
  start: number
  end: number
}

/**
 * Пересекаются ли два интервала. Конец в интервал не входит, поэтому встреча,
 * которая начинается в момент окончания другой, с ней не пересекается.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

/** Даты окна записи в часовом поясе владельца: сегодня и следующие дни. */
export function windowDates(now: number, schedule: Schedule): Temporal.PlainDate[] {
  const today = Temporal.Instant.fromEpochMilliseconds(now)
    .toZonedDateTimeISO(schedule.timeZone)
    .toPlainDate()
  return Array.from({ length: schedule.windowDays }, (_, index) => today.add({ days: index }))
}

/**
 * Слоты одного дня для встречи заданной длительности. Первый слот начинается
 * с началом рабочего дня, каждый следующий в момент окончания предыдущего.
 */
export function daySlots(
  date: Temporal.PlainDate,
  durationMinutes: number,
  schedule: Schedule,
): Interval[] {
  const instantAt = (time: string) =>
    date.toZonedDateTime({ timeZone: schedule.timeZone, plainTime: time }).epochMilliseconds

  const dayEnd = instantAt(schedule.workDayEnd)
  const duration = durationMinutes * 60_000
  const slots: Interval[] = []
  for (
    let start = instantAt(schedule.workDayStart);
    start + duration <= dayEnd;
    start += duration
  ) {
    slots.push({ start, end: start + duration })
  }
  return slots
}
