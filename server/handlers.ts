import {
  type BookingRules,
  buildBookingWindow,
  createBooking,
  listUpcomingBookings,
} from './booking.ts'
import type { RouteHandlers } from './generated/fastify.gen.ts'
import type { Booking, NotFoundError, ValidationError } from './generated/types.gen.ts'
import type { StoredBooking } from './store.ts'

const toIso = (instant: number) => new Date(instant).toISOString()

function toBooking(booking: StoredBooking): Booking {
  return {
    id: booking.id,
    eventType: booking.eventType,
    startTime: toIso(booking.start),
    endTime: toIso(booking.end),
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    ...(booking.notes ? { notes: booking.notes } : {}),
    createdAt: toIso(booking.createdAt),
  }
}

const eventTypeNotFound: NotFoundError = {
  code: 'not_found',
  message: 'Тип встречи не найден',
}

function startTimeError(message: string): ValidationError {
  return {
    code: 'validation_error',
    message: 'Данные запроса не прошли проверку',
    issues: [{ field: 'startTime', message }],
  }
}

/** Обработчики операций контракта. Имена совпадают с `operationId` из OpenAPI. */
export function createHandlers(rules: BookingRules): RouteHandlers {
  const { store } = rules

  return {
    getHealth: async (_request, reply) => reply.code(200).send({ status: 'ok' }),

    getSchedule: async (_request, reply) => reply.code(200).send(rules.schedule),

    listEventTypes: async (_request, reply) => reply.code(200).send(store.listEventTypes()),

    createEventType: async (request, reply) => {
      const { id, title, description, durationMinutes } = request.body
      const eventType = {
        id,
        title: title.trim(),
        description: description.trim(),
        durationMinutes,
      }
      if (!store.addEventType(eventType)) {
        return reply.code(409).send({
          code: 'event_type_exists',
          message: `Тип встречи с идентификатором «${id}» уже существует`,
        })
      }
      return reply.code(201).send(eventType)
    },

    getEventType: async (request, reply) => {
      const eventType = store.getEventType(request.params.eventTypeId)
      if (!eventType) {
        return reply.code(404).send(eventTypeNotFound)
      }
      return reply.code(200).send(eventType)
    },

    getBookingWindow: async (request, reply) => {
      const eventType = store.getEventType(request.params.eventTypeId)
      if (!eventType) {
        return reply.code(404).send(eventTypeNotFound)
      }
      return reply.code(200).send(buildBookingWindow(eventType, rules))
    },

    listBookings: async (_request, reply) =>
      reply.code(200).send(listUpcomingBookings(rules).map(toBooking)),

    createBooking: async (request, reply) => {
      const result = createBooking(request.body, rules)
      if (result.ok) {
        return reply.code(201).send(toBooking(result.booking))
      }
      switch (result.reason) {
        case 'event_type_not_found':
          return reply.code(404).send(eventTypeNotFound)
        case 'not_a_slot':
          return reply
            .code(422)
            .send(startTimeError('Время не совпадает ни с одним слотом окна записи'))
        case 'slot_started':
          return reply.code(422).send(startTimeError('Этот слот уже начался'))
        case 'slot_taken':
          return reply.code(409).send({
            code: 'slot_taken',
            message: 'Это время уже занято. Выберите другой слот',
          })
      }
    },
  }
}
