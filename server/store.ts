import type { EventType } from './generated/types.gen.ts'
import type { Interval } from './schedule.ts'

/** Запись в том виде, в котором её хранит сервер: время в миллисекундах эпохи. */
export type StoredBooking = Interval & {
  id: string
  eventType: EventType
  guestName: string
  guestEmail: string
  notes?: string
  createdAt: number
}

/**
 * Хранилище в памяти процесса. Перезапуск приложения сбрасывает все данные.
 * Методы синхронные: между проверкой и изменением не выполняется другой код,
 * на этом держится защита от двух одновременных записей на одно время.
 */
export class Store {
  readonly #eventTypes = new Map<string, EventType>()
  readonly #bookings: StoredBooking[] = []

  constructor(eventTypes: EventType[] = []) {
    for (const eventType of eventTypes) {
      this.#eventTypes.set(eventType.id, eventType)
    }
  }

  listEventTypes(): EventType[] {
    return [...this.#eventTypes.values()]
  }

  getEventType(id: string): EventType | undefined {
    return this.#eventTypes.get(id)
  }

  /** Добавляет тип встречи. Возвращает `false`, если идентификатор уже занят. */
  addEventType(eventType: EventType): boolean {
    if (this.#eventTypes.has(eventType.id)) {
      return false
    }
    this.#eventTypes.set(eventType.id, eventType)
    return true
  }

  listBookings(): readonly StoredBooking[] {
    return this.#bookings
  }

  addBooking(booking: StoredBooking): void {
    this.#bookings.push(booking)
  }
}
