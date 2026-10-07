import { Router } from "express";
import { Request_CalendarCreateCalendar } from "../../../model/requests/Request_CalendarCreateCalendar.js";
import { Request_CalendarCreateEvent } from "../../../model/requests/Request_CalendarCreateEvent.js";
import { Request_CalendarDeleteEvent } from "../../../model/requests/Request_CalendarDeleteEvent.js";
import { Request_CalendarGetCalendars } from "../../../model/requests/Request_CalendarGetCalendars.js";
import { Request_CalendarGetEvents } from "../../../model/requests/Request_CalendarGetEvents.js";
import { Request_CalendarGetModuleCalendars } from "../../../model/requests/Request_CalendarGetModuleCalendars.js";
import { Request_CalendarUpdateCalendar } from "../../../model/requests/Request_CalendarUpdateCalendar.js";
import { Request_CalendarUpdateEvent } from "../../../model/requests/Request_CalendarUpdateEvent.js";
import { CalendarModuleManager } from "../../../modules/calendar/calendarModuleManager.js";
import { endpoint } from "../../http/endpoint.js";
import { CalendarService } from "../../services/modules/calendar.service.js";
import { calendarValidation } from "../../validation/modules/calendar.validation.js";
import type { RouterDeps } from "../../router.js";

export function createCalendarModuleRouter(deps: RouterDeps): Router {
  const router = Router();
  const calendarModule = new CalendarModuleManager(deps.databaseManager, deps.actionManager, deps.eventManager);
  deps.actionManager.registerModuleManager(calendarModule);
  const calendarService = new CalendarService(calendarModule, deps.actionManager);

  router.get("/calendars", ...endpoint({
    schema: calendarValidation.getCalendars,
    toRequest: () => new Request_CalendarGetCalendars(),
    serve: request => calendarService.getCalendars(request)
  }));

  router.get("/events", ...endpoint({
    schema: calendarValidation.getEvents,
    toRequest: ({ query }) => new Request_CalendarGetEvents(query),
    serve: request => calendarService.getEvents(request)
  }));

  router.post("/calendars", ...endpoint({
    schema: calendarValidation.createCalendar,
    toRequest: ({ body }) => new Request_CalendarCreateCalendar(body),
    serve: request => calendarService.createCalendar(request),
    status: 201
  }));

  router.post("/events", ...endpoint({
    schema: calendarValidation.createEvent,
    toRequest: ({ body }) => new Request_CalendarCreateEvent(body),
    serve: request => calendarService.createEvent(request),
    status: 201
  }));

  router.put("/events/:eventId", ...endpoint({
    schema: calendarValidation.updateEvent,
    toRequest: ({ params, body }) => new Request_CalendarUpdateEvent({ ...body, eventId: params.eventId }),
    serve: request => calendarService.updateEvent(request)
  }));

  router.delete("/events/:eventId", ...endpoint({
    schema: calendarValidation.deleteEvent,
    toRequest: ({ params }) => new Request_CalendarDeleteEvent(params),
    serve: request => calendarService.deleteEvent(request)
  }));

  router.put("/calendars/:calendarId", ...endpoint({
    schema: calendarValidation.updateCalendar,
    toRequest: ({ params, body }) => new Request_CalendarUpdateCalendar({ ...body, calendarId: params.calendarId }),
    serve: request => calendarService.updateCalendar(request)
  }));

  router.get("/calendars/:moduleId", ...endpoint({
    schema: calendarValidation.getModuleCalendars,
    toRequest: ({ params }) => new Request_CalendarGetModuleCalendars(params),
    serve: request => calendarService.getModuleCalendars(request)
  }));

  return router;
}
