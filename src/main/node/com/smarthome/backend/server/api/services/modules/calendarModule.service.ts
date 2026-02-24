import { Router } from "express";
import crypto from "node:crypto";
import type { DatabaseManager } from "../../../db/database.js";
import type { EventStreamManager } from "../../../events/eventStreamManager.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { logger } from "../../../../logger.js";
import { CalendarModuleManager } from "../../modules/calendar/calendarModuleManager.js";
import { DEFAULT_CALENDAR_DEVICE_ID, DEFAULT_CALENDAR_MODULE_ID, DeviceCalendar, type DeviceCalendarEntry } from "../../../../model/devices/DeviceCalendar.js";
import { CALENDARCONFIG } from "../../modules/calendar/calendarModule.js";
import { DEFAULT_CREDENTIALS_ID } from "../../modules/appleCalendar/appleCalendarDeviceDiscover.js";

type Deps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || "Unbekannter Fehler";
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unbekannter Fehler";
  }
}

export function createCalendarModuleRouter(deps: Deps): Router{
  const router = Router();

  const calendarModule = new CalendarModuleManager(deps.databaseManager, deps.actionManager, deps.eventStreamManager);
  deps.actionManager.registerModuleManager(calendarModule);

  function getCalendarDevice(): DeviceCalendar | null {
    const device = deps.actionManager.getDevice(DEFAULT_CALENDAR_DEVICE_ID);
    return device as DeviceCalendar | null;
  }

  function ensureCalendarDevice(): DeviceCalendar {
    const existing = getCalendarDevice();
    if (existing) return existing;
    const device = new DeviceCalendar({});
    device.addModule(calendarModule);
    deps.actionManager.saveDevice(device);
    return device;
  }

  ensureCalendarDevice();

  

  /**
   * Listet bekannte Kalender (System + gefundene Provider-Kalender).
   */
  router.get("/calendars", (_req, res) => {
    try {
      const device = getCalendarDevice();
      if( device ) {
        const calendars = device.getCalendars();
        res.status(200).json(calendars);
      } else {
        res.status(200).json([]);
      }
    } catch (error) {
      logger.error({ err: error }, "Fehler beim Laden der Kalender-Liste");
      res.status(500).json({ error: toErrorMessage(error) || "Fehler beim Laden der Kalender" });
    }
  });

  
  router.get("/events", (_req, res) => {
    try {
      const device = getCalendarDevice();
      if( device ) {
        const events = device.getEntries();
        res.status(200).json(events);
      } else {
        res.status(200).json([]);
      }
    } catch (error) {
      logger.error({ err: error }, "Fehler beim Laden der Kalender-Liste");
      res.status(500).json({ error: toErrorMessage(error) || "Fehler beim Laden der Kalender" });
    }
  });

  router.post("/calendars", (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    const color = String(req.body?.color ?? "").trim();
    const show = req.body?.show;

    if (!name) {
      res.status(400).json({ error: "name ist erforderlich" });
      return;
    }
    if (!color) {
      res.status(400).json({ error: "color ist erforderlich" });
      return;
    }
    if (typeof show !== "boolean") {
      res.status(400).json({ error: "show ist erforderlich und muss true/false sein" });
      return;
    }

    const moduleId = DEFAULT_CALENDAR_MODULE_ID;
    const device = getCalendarDevice();
    if (!device) {
      res.status(404).json({ error: "Kalender nicht gefunden" });
      return;
    }

    try {
      const createdCalendar = calendarModule.createManualCalendar(device, {
        id: String(req.body?.id ?? "").trim() || undefined,
        name,
        color,
        show
      });
      deps.actionManager.saveDevice(device);
      res.status(201).json(createdCalendar);
    } catch (error) {
      const message = toErrorMessage(error);
      if (message.includes("existiert bereits")) {
        res.status(409).json({ error: message });
        return;
      }
      res.status(400).json({ error: message || "Fehler beim Erstellen des Kalenders" });
    }
  });

  router.post("/events", async (req, res) => {
    const calendarId = String(req.body?.calendarId ?? "").trim();
    const title = String(req.body?.title ?? "").trim();
    const start = String(req.body?.start ?? "").trim();
    const end = String(req.body?.end ?? "").trim();
    const description = req.body?.description;
    const location = req.body?.location;
    const notificationEnabled = req.body?.notificationEnabled;
    const allDay = req.body?.allDay;

    if (!calendarId) {
      res.status(400).json({ error: "calendarId ist erforderlich" });
      return;
    }
    if (!start || Number.isNaN(new Date(start).getTime())) {
      res.status(400).json({ error: "start ist erforderlich und muss ein gueltiges ISO-Datum sein" });
      return;
    }
    if (!end || Number.isNaN(new Date(end).getTime())) {
      res.status(400).json({ error: "end ist erforderlich und muss ein gueltiges ISO-Datum sein" });
      return;
    }

    try {
      const device = getCalendarDevice();
      if (!device) {
        res.status(404).json({ error: "Kalender nicht gefunden" });
        return;
      }

      const calendar = device.getCalendars().find(c => String(c.id ?? "").trim() === calendarId);
      if (!calendar) {
        res.status(404).json({ error: `Kalender '${calendarId}' nicht gefunden` });
        return;
      }

      const newEntry: DeviceCalendarEntry = {
        id: crypto.randomUUID(),
        calendarId: calendar.id,
        calendarName: calendar.name,
        moduleId: calendar.moduleId,
        title: title || "(ohne Titel)",
        description: typeof description === "string" ? description : "",
        location: typeof location === "string" ? location : "",
        start,
        end,
        allDay: typeof allDay === "boolean" ? allDay : false,
        notificationEnabled: typeof notificationEnabled === "boolean" ? notificationEnabled : true,
        attendees: [],
        organizer: { name: "", email: "" },
        status: "",
        recurrenceRule: "",
        updatedAt: new Date().toISOString(),
        properties: {
          credentialId: calendar.properties?.credentialId ?? DEFAULT_CREDENTIALS_ID,
        }
      };

      await device.addEntry(newEntry, true);
      deps.actionManager.saveDevice(device);
      res.status(201).json({ id: newEntry.id });
    } catch (error) {
      logger.error({ err: error, calendarId }, "Fehler beim Erstellen eines Kalender-Termins");
      res.status(500).json({ error: toErrorMessage(error) || "Fehler beim Erstellen des Termins" });
    }
  });

  router.put("/events/:eventId", async (req, res) => {
    const rawEventId = String(req.params.eventId ?? "").trim();
    let eventId = rawEventId;
    try {
      eventId = decodeURIComponent(rawEventId);
    } catch {
      res.status(400).json({ error: "Ungueltige Event-ID in URL" });
      return;
    }
    if (!eventId) {
      res.status(400).json({ error: "Event-ID muss in der URL als /events/:eventId angegeben werden" });
      return;
    }
    const start = req.body?.start;
    const end = req.body?.end;
    const calendarId = req.body?.calendarId;
    const title = req.body?.title;
    const description = req.body?.description;
    const location = req.body?.location;
    const notificationEnabled = req.body?.notificationEnabled;
    const allDay = req.body?.allDay;

    if (
      start === undefined &&
      end === undefined &&
      calendarId === undefined &&
      title === undefined &&
      description === undefined &&
      location === undefined &&
      notificationEnabled === undefined &&
      allDay === undefined
    ) {
      res.status(400).json({ error: "Keine Aenderung angegeben" });
      return;
    }

    try {
      const device = getCalendarDevice();
      if (!device) {
        res.status(404).json({ error: "Kalender nicht gefunden" });
        return;
      }
      if (typeof start === "string") {
        await device.changeEntryTimeStart(eventId, start);
      }
      if (typeof end === "string") {
        await device.changeEntryTimeEnd(eventId, end);
      }
      if (typeof calendarId === "string" && calendarId.trim()) {
        await device.changeEntryCalendar(eventId, calendarId.trim());
      }
      if (typeof title === "string") {
        await device.changeEntryName(eventId, title);
      }
      if (typeof description === "string") {
        await device.changeEntryNotice(eventId, description);
      }
      if (typeof location === "string") {
        await device.changeEntryAddress(eventId, location);
      }
      if (typeof notificationEnabled === "boolean") {
        await device.changeEntryNotification(eventId, notificationEnabled);
      }
      if (typeof allDay === "boolean") {
        await device.changeEntryAllDay(eventId, allDay);
      }
      deps.actionManager.saveDevice(device);
      res.status(200).json({
        id: eventId,
        start,
        end,
        calendarId,
        title,
        description,
        location,
        notificationEnabled,
        allDay
      });
    } catch (error) {
      logger.error({ err: error, eventId }, "Fehler beim Aktualisieren eines Kalender-Termins");
      res.status(500).json({ error: toErrorMessage(error) || "Fehler beim Aktualisieren des Termins" });
    }
  });

  router.delete("/events/:eventId", async (req, res) => {
    const rawEventId = String(req.params.eventId ?? "").trim();
    let eventId = rawEventId;
    try {
      eventId = decodeURIComponent(rawEventId);
    } catch {
      res.status(400).json({ error: "Ungueltige Event-ID in URL" });
      return;
    }
    if (!eventId) {
      res.status(400).json({ error: "Event-ID muss in der URL als /events/:eventId angegeben werden" });
      return;
    }

    try {
      const device = getCalendarDevice();
      if (!device) {
        res.status(404).json({ error: "Kalender nicht gefunden" });
        return;
      }
      await device.deleteEntry(eventId);
      deps.actionManager.saveDevice(device);
      res.status(200).json({ id: eventId });
    } catch (error) {
      logger.error({ err: error, eventId }, "Fehler beim Loeschen eines Kalender-Termins");
      res.status(500).json({ error: toErrorMessage(error) || "Fehler beim Loeschen des Termins" });
    }
  });

  /**
   * Setzt Config (show/color/name) pro Kalender.
   * Persistiert im zentralen calendar Device-State (DeviceCalendar.entryCategories) als id = <calendarId>.
   */
  router.put("/calendars/:calendarId", async (req, res) => {
    const calendarId = (req.params.calendarId ?? "").trim();
    if (!calendarId) {
      res.status(400).json({ error: "Ungueltige Kalender-ID" });
      return;
    }
    const device = getCalendarDevice();
    if( device ) {
      const calendar = device.getCalendars().find(entry => String(entry.id ?? "").trim() === calendarId);
      if (!calendar) {
        res.status(404).json({ error: "Kalender nicht gefunden" });
        return;
      }
      if (req.body?.name !== undefined && calendar.properties?.createdManually !== true) {
        res.status(403).json({ error: "Name kann nur bei manuell erstellten Kalendern geaendert werden" });
        return;
      }
      device.changeCalendarConfig(calendarId, {
        show: req.body.show,
        color: req.body.color,
        name: req.body.name,
      });
      deps.actionManager.saveDevice(device);
      res.status(200).json({ id: calendarId, show: req.body.show, color: req.body.color, name: req.body.name });
      return;
    }
    res.status(404).json({ error: "Kalender nicht gefunden" });
  });

  router.get("/calendars/:moduleId", (req, res) => {
    const moduleId = (req.params.moduleId ?? "").trim();
    if (!moduleId) {
      res.status(400).json({ error: "Ungueltige Kalender-ID" });
      return;
    }
    const device = getCalendarDevice();
    if( device ) {
      const calendars = device.getCalendarsForModule(moduleId);
      res.status(200).json(calendars);
      return;
    }
    res.status(200).json([]);
  });

  return router;
}


