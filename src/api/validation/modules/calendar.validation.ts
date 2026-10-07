import { z } from "zod";

const calendarIdParams = z.object({
  calendarId: z.string().trim().min(1)
});

const moduleIdParams = z.object({
  moduleId: z.string().trim().min(1)
});

const eventIdParams = z.object({
  eventId: z
    .string()
    .trim()
    .transform((value, ctx) => {
      try {
        return decodeURIComponent(value);
      } catch {
        ctx.issues.push({ code: "custom", message: "Ungültige Event-ID in URL", input: value });
        return z.NEVER;
      }
    })
    .pipe(z.string().min(1))
});

const isoDateTime = z
  .string()
  .trim()
  .refine(value => !Number.isNaN(new Date(value).getTime()), "Muss ein gültiges ISO-Datum sein");

const eventPatchBody = z
  .object({
    start: z.string().nullish(),
    end: z.string().nullish(),
    calendarId: z.string().nullish(),
    title: z.string().nullish(),
    description: z.string().nullish(),
    location: z.string().nullish(),
    notificationEnabled: z.boolean().nullish(),
    allDay: z.boolean().nullish()
  })
  .refine(patch => Object.values(patch).some(value => value !== undefined), "Keine Änderung angegeben");

export const calendarValidation = {
  getCalendars: z.object({}),
  getEvents: z.object({
    query: z.object({
      from: z.string().nullish(),
      to: z.string().nullish()
    })
  }),
  createCalendar: z.object({
    body: z.object({
      id: z.string().trim().nullish(),
      name: z.string().trim().min(1),
      color: z.string().trim().min(1),
      show: z.boolean()
    })
  }),
  createEvent: z.object({
    body: z.object({
      calendarId: z.string().trim().min(1),
      title: z.string().trim().nullish(),
      start: isoDateTime,
      end: isoDateTime,
      description: z.string().nullish(),
      location: z.string().nullish(),
      notificationEnabled: z.boolean().nullish(),
      allDay: z.boolean().nullish()
    })
  }),
  updateEvent: z.object({ params: eventIdParams, body: eventPatchBody }),
  deleteEvent: z.object({ params: eventIdParams }),
  updateCalendar: z.object({
    params: calendarIdParams,
    body: z.object({
      show: z.boolean().nullish(),
      color: z.string().nullish(),
      name: z.string().nullish(),
      assignedUserIds: z.array(z.string()).nullish()
    })
  }),
  getModuleCalendars: z.object({ params: moduleIdParams })
};
