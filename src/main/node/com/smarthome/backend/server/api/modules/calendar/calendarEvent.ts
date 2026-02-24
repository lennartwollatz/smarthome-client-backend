import { DeviceCalendarEntry } from "../../../../model/devices/DeviceCalendar.js";
import { ModuleEvent } from "../moduleEvent.js";

/**
 * Event-Typ für den (optional) gestreamten Kalender-EventStream.
 *
 * Hinweis: Für den Standardkalender (`isDefaultSystemCalendar === true`) werden bewusst keine Events erzeugt.
 */
export interface CalendarEvent extends ModuleEvent {
  deviceId: string;
}


