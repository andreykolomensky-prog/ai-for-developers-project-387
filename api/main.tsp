import "@typespec/http";
import "@typespec/openapi";

using Http;
using OpenAPI;

/**
 * Контракт сервиса записи на звонок. Владелец заводит типы встреч и смотрит
 * записи, гость выбирает свободный слот в окне записи и создаёт запись.
 */
@service(#{ title: "Запись на звонок" })
@info(#{ version: "1.0.0" })
@route("/api")
namespace CallCalendar;

/** Тип встречи: шаблон, который заводит владелец. */
model EventType {
  /** Идентификатор, который задаёт владелец. Попадает в адрес страницы записи. */
  @minLength(1)
  @maxLength(40)
  @pattern("^[a-z0-9]+(-[a-z0-9]+)*$")
  id: string;

  /** Название, которое видит гость. Не может состоять из одних пробелов. */
  @minLength(1)
  @maxLength(80)
  @pattern("\\S")
  title: string;

  /** Описание для гостя. Может быть пустым. */
  @maxLength(500)
  description: string;

  /** Длительность встречи в минутах. Слот этого типа длится столько же. */
  @minValue(5)
  @maxValue(480)
  durationMinutes: int32;
}

/** Расписание владельца: когда и на сколько дней вперёд гости могут записываться. */
model Schedule {
  /** Часовой пояс владельца (IANA). В нём заданы рабочие часы и даты окна записи. */
  timeZone: string;

  /** Начало рабочего дня, `ЧЧ:ММ`. */
  workDayStart: string;

  /** Конец рабочего дня, `ЧЧ:ММ`. Слот должен закончиться не позже. */
  workDayEnd: string;

  /** Длина окна записи в календарных днях, считая сегодняшний. */
  windowDays: int32;
}

/** Слот: интервал, на который гость может записаться. */
model Slot {
  /** Начало слота. */
  startTime: utcDateTime;

  /** Конец слота: начало плюс длительность типа встречи. */
  endTime: utcDateTime;

  /** Свободен ли слот: он ещё не начался и не пересекается ни с одной записью. */
  available: boolean;
}

/** Слоты одного календарного дня. */
model BookingWindowDay {
  /** Дата в часовом поясе владельца. */
  date: plainDate;

  /** Слоты дня по возрастанию времени начала. */
  slots: Slot[];
}

/** Окно записи: ближайшие 14 календарных дней, начиная с сегодняшнего. */
model BookingWindow {
  /** Часовой пояс владельца (IANA), в котором заданы даты и рабочие часы. */
  timeZone: string;

  /** Ровно 14 дней подряд, первый из них сегодняшний. */
  days: BookingWindowDay[];
}

/** Запись: встреча гостя с владельцем, занявшая слот. */
model Booking {
  id: string;

  /** Тип встречи, на который создана запись. */
  eventType: EventType;

  startTime: utcDateTime;
  endTime: utcDateTime;
  guestName: string;
  guestEmail: string;

  /** Заметка гостя для владельца. */
  notes?: string;

  createdAt: utcDateTime;
}

/** Данные, которые гость отправляет при создании записи. */
model CreateBookingRequest {
  /** Идентификатор типа встречи. */
  eventTypeId: string;

  /** Начало выбранного слота. Должно совпадать с началом свободного слота из окна записи. */
  startTime: utcDateTime;

  /** Имя гостя. Не может состоять из одних пробелов. */
  @minLength(1)
  @maxLength(80)
  @pattern("\\S")
  guestName: string;

  @format("email")
  @maxLength(254)
  guestEmail: string;

  @maxLength(500)
  notes?: string;
}

/** Одно замечание к данным запроса. */
model ValidationIssue {
  /** Поле запроса, к которому относится замечание. */
  field: string;

  message: string;
}

/** Данные запроса не прошли проверку. */
@error
model ValidationError {
  @statusCode _: 422;
  code: "validation_error";
  message: string;
  issues: ValidationIssue[];
}

/** Запрошенный ресурс не найден. */
@error
model NotFoundError {
  @statusCode _: 404;
  code: "not_found";
  message: string;
}

/** Тип встречи с таким идентификатором уже существует. */
@error
model EventTypeExistsError {
  @statusCode _: 409;
  code: "event_type_exists";
  message: string;
}

/** Выбранное время пересекается с существующей записью. */
@error
model SlotTakenError {
  @statusCode _: 409;
  code: "slot_taken";
  message: string;
}

model Health {
  status: "ok";
}

@route("/health")
@tag("Служебное")
interface HealthChecks {
  /** Проверка, что приложение запущено. */
  @operationId("getHealth")
  @get
  check(): Health;
}

@route("/schedule")
@tag("Расписание")
interface Schedules {
  /** Расписание владельца: часовой пояс, рабочие часы и длина окна записи. */
  @operationId("getSchedule")
  @get
  read(): Schedule;
}

@route("/event-types")
@tag("Типы встреч")
interface EventTypes {
  /** Список типов встреч в порядке создания. */
  @operationId("listEventTypes")
  @get
  list(): EventType[];

  /** Владелец создаёт тип встречи. */
  @operationId("createEventType")
  @post
  create(@body body: EventType): {
    @statusCode _: 201;
    @body body: EventType;
  } | ValidationError | EventTypeExistsError;

  /** Один тип встречи. */
  @operationId("getEventType")
  @get
  @route("{eventTypeId}")
  read(@path eventTypeId: string): EventType | NotFoundError;

  /** Окно записи для типа встречи: слоты на ближайшие 14 дней с отметкой занятости. */
  @operationId("getBookingWindow")
  @get
  @route("{eventTypeId}/booking-window")
  bookingWindow(@path eventTypeId: string): BookingWindow | NotFoundError;
}

@route("/bookings")
@tag("Записи")
interface Bookings {
  /** Предстоящие записи всех типов встреч по возрастанию времени начала. */
  @operationId("listBookings")
  @get
  list(): Booking[];

  /** Гость создаёт запись на свободный слот. */
  @operationId("createBooking")
  @post
  create(@body body: CreateBookingRequest): {
    @statusCode _: 201;
    @body body: Booking;
  } | ValidationError | NotFoundError | SlotTakenError;
}
