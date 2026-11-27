import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type CreateBookingRequest,
  createBooking,
  createEventType,
  type EventType,
  getBookingWindow,
  getEventType,
  getSchedule,
  listBookings,
  listEventTypes,
} from './generated/index.ts'

const queryKeys = {
  eventTypes: ['event-types'] as const,
  eventType: (id: string) => ['event-types', id] as const,
  bookingWindow: (id: string) => ['event-types', id, 'booking-window'] as const,
  bookings: ['bookings'] as const,
  schedule: ['schedule'] as const,
}

/** Ошибка API в виде, удобном интерфейсу: код из контракта и сообщение для человека. */
export type ApiFailure = {
  code: string
  message: string
  issues?: { field: string; message: string }[]
}

const networkFailure: ApiFailure = {
  code: 'network_error',
  message: 'Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.',
}

/** Приводит тело ошибки из SDK к `ApiFailure`. Всё непонятное считаем сбоем связи. */
function toFailure(error: unknown): ApiFailure {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    const { code, message } = error
    if (typeof code === 'string' && typeof message === 'string') {
      const issues = 'issues' in error && Array.isArray(error.issues) ? error.issues : undefined
      return { code, message, ...(issues ? { issues } : {}) }
    }
  }
  return networkFailure
}

export function useEventTypes() {
  return useQuery({
    queryKey: queryKeys.eventTypes,
    queryFn: async () => (await listEventTypes({ throwOnError: true })).data,
  })
}

/** Тип встречи по идентификатору. `null`, если такого типа нет. */
export function useEventType(eventTypeId: string) {
  return useQuery({
    queryKey: queryKeys.eventType(eventTypeId),
    queryFn: async () => {
      const { data, error, response } = await getEventType({ path: { eventTypeId } })
      if (data) {
        return data
      }
      if (response?.status === 404) {
        return null
      }
      throw new Error(toFailure(error).message)
    },
  })
}

export function useBookingWindow(eventTypeId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.bookingWindow(eventTypeId),
    queryFn: async () =>
      (await getBookingWindow({ path: { eventTypeId }, throwOnError: true })).data,
    enabled,
  })
}

/** Расписание владельца: часовой пояс, рабочие часы и длина окна записи. */
export function useSchedule() {
  return useQuery({
    queryKey: queryKeys.schedule,
    queryFn: async () => (await getSchedule({ throwOnError: true })).data,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useBookings() {
  return useQuery({
    queryKey: queryKeys.bookings,
    queryFn: async () => (await listBookings({ throwOnError: true })).data,
  })
}

export function useCreateBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateBookingRequest) => {
      const { data, error } = await createBooking({ body })
      return data
        ? { ok: true as const, booking: data }
        : { ok: false as const, failure: toFailure(error) }
    },
    // После любой попытки занятость слотов могла измениться. Обновление идёт в фоне:
    // ответ на запись показывается сразу, не дожидаясь перечитывания окна записи.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.eventTypes })
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
    },
  })
}

export function useCreateEventType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: EventType) => {
      const { data, error } = await createEventType({ body })
      return data
        ? { ok: true as const, eventType: data }
        : { ok: false as const, failure: toFailure(error) }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.eventTypes })
    },
  })
}
