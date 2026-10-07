import type { RowDataPacket } from "mysql2/promise";
import { DeviceType } from "../../../model/devices/helper/DeviceType.js";
import { DbDeviceCalendar } from "../../../model/db/DbDeviceCalendar.js";
import { DbDeviceCalendarEntry } from "../../../model/db/DbDeviceCalendarEntry.js";
import { DbDeviceCalendarEntryAttendee } from "../../../model/db/DbDeviceCalendarEntryAttendee.js";
import { DbDeviceCalendarEntryOrganizer } from "../../../model/db/DbDeviceCalendarEntryOrganizer.js";
import { DbDeviceCalendarUser } from "../../../model/db/DbDeviceCalendarUser.js";
import type { SqlExecutor } from "../../database.js";
import {
  asRecordArray,
  isRecord,
  toNullableBoolean,
  toNullableString,
  withoutNulls,
  type DeviceTableGroup,
  type PlainDevice
} from "./deviceTableGroup.js";

const SQL_SELECT_CALENDARS = `
  SELECT
      c.id,
      c.device_id           AS deviceId,
      c.sort_index          AS sortIndex,
      c.module_id           AS moduleId,
      c.name,
      c.color,
      c.is_shown            AS isShown,
      c.is_created_manually AS isCreatedManually,
      c.credential_id       AS credentialId
  FROM device_calendars AS c
  ORDER BY c.device_id, c.sort_index`;

const SQL_SELECT_CALENDAR_USERS = `
  SELECT
      u.calendar_id AS calendarId,
      u.user_id     AS userId,
      u.sort_index  AS sortIndex
  FROM device_calendar_users AS u
  ORDER BY u.calendar_id, u.sort_index`;

const SQL_SELECT_ENTRIES = `
  SELECT
      e.calendar_id             AS calendarId,
      e.id,
      e.sort_index              AS sortIndex,
      e.title,
      e.description,
      e.location,
      e.event_url               AS eventUrl,
      e.starts_at               AS startsAt,
      e.ends_at                 AS endsAt,
      e.is_all_day              AS isAllDay,
      e.is_notification_enabled AS isNotificationEnabled,
      e.status,
      e.recurrence_rule         AS recurrenceRule,
      e.remote_updated_at       AS remoteUpdatedAt,
      e.remote_url              AS remoteUrl,
      e.etag,
      e.ical_uid                AS icalUid
  FROM device_calendar_entries AS e
  ORDER BY e.calendar_id, e.sort_index`;

const SQL_SELECT_ORGANIZERS = `
  SELECT
      o.calendar_id AS calendarId,
      o.entry_id    AS entryId,
      o.name,
      o.email
  FROM device_calendar_entry_organizers AS o`;

const SQL_SELECT_ATTENDEES = `
  SELECT
      a.calendar_id AS calendarId,
      a.entry_id    AS entryId,
      a.sort_index  AS sortIndex,
      a.name,
      a.email,
      a.role,
      a.status
  FROM device_calendar_entry_attendees AS a
  ORDER BY a.calendar_id, a.entry_id, a.sort_index`;

/** Löscht über ON DELETE CASCADE auch Benutzerzuordnungen, Termine, Organisatoren und Teilnehmer. */
const SQL_DELETE_CALENDARS = `
  DELETE FROM device_calendars
  WHERE device_id = ?`;

/** Unbekannte Zugangsdaten werden zu NULL, statt am Fremdschlüssel zu scheitern. */
const SQL_INSERT_CALENDAR = `
  INSERT INTO device_calendars (
      id, device_id, sort_index, module_id, name, color, is_shown, is_created_manually, credential_id
  )
  VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      (SELECT mc.id FROM module_credentials AS mc WHERE mc.module_id = ? AND mc.id = ?)
  )`;

/** Nicht (mehr) vorhandene Benutzer werden übersprungen statt am Fremdschlüssel zu scheitern. */
const SQL_INSERT_CALENDAR_USER = `
  INSERT INTO device_calendar_users (calendar_id, user_id, sort_index)
  SELECT ?, u.id, ?
  FROM users AS u
  WHERE u.id = ?`;

const SQL_INSERT_ENTRY = `
  INSERT INTO device_calendar_entries (
      calendar_id, id, sort_index, title, description, location, event_url,
      starts_at, ends_at, is_all_day, is_notification_enabled, status, recurrence_rule, remote_updated_at,
      remote_url, etag, ical_uid
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const SQL_INSERT_ORGANIZER = `
  INSERT INTO device_calendar_entry_organizers (calendar_id, entry_id, name, email)
  VALUES (?, ?, ?, ?)`;

const SQL_INSERT_ATTENDEE = `
  INSERT INTO device_calendar_entry_attendees (calendar_id, entry_id, sort_index, name, email, role, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)`;

const entryKey = (calendarId: string, entryId: string) => `${calendarId}\u0000${entryId}`;

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const list = grouped.get(key(item));
    if (list) list.push(item);
    else grouped.set(key(item), [item]);
  }
  return grouped;
}

/**
 * Kalender des Kalender-Geräts. Von den freien `properties` werden nur die genutzten Schlüssel gespeichert:
 * Kalender `credentialId`/`createdManually`, Termine `credentialId`/`url`/`etag`/`calendarDataParsed.uid`.
 * `calendarName` und `moduleId` eines Termins ergeben sich aus seinem Kalender.
 */
export const calendarTables: DeviceTableGroup = {
  appliesTo: device => device.type === DeviceType.CALENDAR,

  async load(db, devices) {
    const calendars = (await db.query<RowDataPacket>(SQL_SELECT_CALENDARS)).map(row => new DbDeviceCalendar({
      id: row.id,
      deviceId: row.deviceId,
      sortIndex: row.sortIndex,
      moduleId: row.moduleId,
      name: row.name,
      color: row.color,
      isShown: toNullableBoolean(row.isShown) ?? false,
      isCreatedManually: toNullableBoolean(row.isCreatedManually) ?? false,
      credentialId: row.credentialId
    }));
    if (calendars.length === 0) return;

    const users = (await db.query<RowDataPacket>(SQL_SELECT_CALENDAR_USERS)).map(row => new DbDeviceCalendarUser({
      calendarId: row.calendarId,
      userId: row.userId,
      sortIndex: row.sortIndex
    }));
    const entries = (await db.query<RowDataPacket>(SQL_SELECT_ENTRIES)).map(row => new DbDeviceCalendarEntry({
      calendarId: row.calendarId,
      id: row.id,
      sortIndex: row.sortIndex,
      title: row.title,
      description: row.description,
      location: row.location,
      eventUrl: row.eventUrl,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      isAllDay: toNullableBoolean(row.isAllDay),
      isNotificationEnabled: toNullableBoolean(row.isNotificationEnabled) ?? true,
      status: row.status,
      recurrenceRule: row.recurrenceRule,
      remoteUpdatedAt: row.remoteUpdatedAt,
      remoteUrl: row.remoteUrl,
      etag: row.etag,
      icalUid: row.icalUid
    }));
    const organizers = (await db.query<RowDataPacket>(SQL_SELECT_ORGANIZERS)).map(row => new DbDeviceCalendarEntryOrganizer({
      calendarId: row.calendarId,
      entryId: row.entryId,
      name: row.name,
      email: row.email
    }));
    const attendees = (await db.query<RowDataPacket>(SQL_SELECT_ATTENDEES)).map(row => new DbDeviceCalendarEntryAttendee({
      calendarId: row.calendarId,
      entryId: row.entryId,
      sortIndex: row.sortIndex,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status
    }));

    const usersByCalendar = groupBy(users, user => user.calendarId);
    const entriesByCalendar = groupBy(entries, entry => entry.calendarId);
    const organizerByEntry = new Map(organizers.map(organizer => [entryKey(organizer.calendarId, organizer.entryId), organizer]));
    const attendeesByEntry = groupBy(attendees, attendee => entryKey(attendee.calendarId, attendee.entryId));

    for (const [deviceId, deviceCalendars] of groupBy(calendars, calendar => calendar.deviceId)) {
      const device = devices.get(deviceId);
      if (!device) continue;
      device.calendars = deviceCalendars.map(calendar => ({
        id: calendar.id,
        name: calendar.name,
        show: calendar.isShown,
        color: calendar.color,
        moduleId: calendar.moduleId,
        assignedUserIds: (usersByCalendar.get(calendar.id) ?? []).map(user => user.userId),
        entries: (entriesByCalendar.get(calendar.id) ?? []).map(entry => {
          const key = entryKey(calendar.id, entry.id);
          const organizer = organizerByEntry.get(key);
          return withoutNulls({
            id: entry.id,
            calendarId: calendar.id,
            calendarName: calendar.name,
            moduleId: calendar.moduleId,
            title: entry.title,
            description: entry.description,
            location: entry.location,
            url: entry.eventUrl,
            start: entry.startsAt,
            end: entry.endsAt,
            allDay: entry.isAllDay,
            notificationEnabled: entry.isNotificationEnabled,
            attendees: (attendeesByEntry.get(key) ?? []).map(attendee => withoutNulls({
              name: attendee.name,
              email: attendee.email,
              role: attendee.role,
              status: attendee.status
            })),
            organizer: organizer ? withoutNulls({ name: organizer.name, email: organizer.email }) : null,
            status: entry.status,
            recurrenceRule: entry.recurrenceRule,
            updatedAt: entry.remoteUpdatedAt,
            properties: toEntryProperties(calendar, entry)
          });
        }),
        ...(toCalendarProperties(calendar) ? { properties: toCalendarProperties(calendar) } : {})
      }));
    }
  },

  async save(tx, device) {
    await tx.execute(SQL_DELETE_CALENDARS, [device.id]);
    const seenCalendarIds = new Set<string>();
    for (const [sortIndex, calendar] of asRecordArray(device.calendars).entries()) {
      const calendarId = toNullableString(calendar.id);
      if (!calendarId || seenCalendarIds.has(calendarId)) continue;
      seenCalendarIds.add(calendarId);
      await saveCalendar(tx, device, calendarId, sortIndex, calendar);
    }
  }
};

async function saveCalendar(
  tx: SqlExecutor,
  device: PlainDevice,
  calendarId: string,
  sortIndex: number,
  calendar: Record<string, unknown>
): Promise<void> {
  const properties = isRecord(calendar.properties) ? calendar.properties : {};
  const dbCalendar = new DbDeviceCalendar({
    id: calendarId,
    deviceId: device.id,
    sortIndex,
    moduleId: toNullableString(calendar.moduleId) ?? "",
    name: toNullableString(calendar.name) ?? "",
    color: toNullableString(calendar.color) ?? "",
    isShown: toNullableBoolean(calendar.show) ?? false,
    isCreatedManually: properties.createdManually === true,
    credentialId: toNullableString(properties.credentialId)
  });
  await tx.execute(SQL_INSERT_CALENDAR, [
    dbCalendar.id,
    dbCalendar.deviceId,
    dbCalendar.sortIndex,
    dbCalendar.moduleId,
    dbCalendar.name,
    dbCalendar.color,
    dbCalendar.isShown,
    dbCalendar.isCreatedManually,
    dbCalendar.moduleId,
    dbCalendar.credentialId
  ]);

  const userIds = Array.isArray(calendar.assignedUserIds) ? calendar.assignedUserIds : [];
  for (const [userIndex, userId] of [...new Set(userIds.filter((id): id is string => typeof id === "string"))].entries()) {
    const user = new DbDeviceCalendarUser({ calendarId, userId, sortIndex: userIndex });
    await tx.execute(SQL_INSERT_CALENDAR_USER, [user.calendarId, user.sortIndex, user.userId]);
  }

  const seenEntryIds = new Set<string>();
  for (const [entryIndex, entry] of asRecordArray(calendar.entries).entries()) {
    const entryId = toNullableString(entry.id);
    if (!entryId || seenEntryIds.has(entryId)) continue;
    seenEntryIds.add(entryId);
    await saveEntry(tx, calendarId, entryId, entryIndex, entry);
  }
}

async function saveEntry(
  tx: SqlExecutor,
  calendarId: string,
  entryId: string,
  sortIndex: number,
  entry: Record<string, unknown>
): Promise<void> {
  const properties = isRecord(entry.properties) ? entry.properties : {};
  const parsed = isRecord(properties.calendarDataParsed) ? properties.calendarDataParsed : {};
  const dbEntry = new DbDeviceCalendarEntry({
    calendarId,
    id: entryId,
    sortIndex,
    title: toNullableString(entry.title) ?? "",
    description: toNullableString(entry.description),
    location: toNullableString(entry.location),
    eventUrl: toNullableString(entry.url),
    startsAt: toNullableString(entry.start) ?? "",
    endsAt: toNullableString(entry.end) ?? "",
    isAllDay: toNullableBoolean(entry.allDay),
    isNotificationEnabled: toNullableBoolean(entry.notificationEnabled) ?? true,
    status: toNullableString(entry.status),
    recurrenceRule: toNullableString(entry.recurrenceRule),
    remoteUpdatedAt: toNullableString(entry.updatedAt) ?? "",
    remoteUrl: toNullableString(properties.url),
    etag: toNullableString(properties.etag),
    icalUid: toNullableString(parsed.uid)
  });
  await tx.execute(SQL_INSERT_ENTRY, [
    dbEntry.calendarId,
    dbEntry.id,
    dbEntry.sortIndex,
    dbEntry.title,
    dbEntry.description,
    dbEntry.location,
    dbEntry.eventUrl,
    dbEntry.startsAt,
    dbEntry.endsAt,
    dbEntry.isAllDay,
    dbEntry.isNotificationEnabled,
    dbEntry.status,
    dbEntry.recurrenceRule,
    dbEntry.remoteUpdatedAt,
    dbEntry.remoteUrl,
    dbEntry.etag,
    dbEntry.icalUid
  ]);

  if (isRecord(entry.organizer)) {
    const organizer = new DbDeviceCalendarEntryOrganizer({
      calendarId,
      entryId,
      name: toNullableString(entry.organizer.name),
      email: toNullableString(entry.organizer.email)
    });
    await tx.execute(SQL_INSERT_ORGANIZER, [organizer.calendarId, organizer.entryId, organizer.name, organizer.email]);
  }

  for (const [attendeeIndex, attendee] of asRecordArray(entry.attendees).entries()) {
    const dbAttendee = new DbDeviceCalendarEntryAttendee({
      calendarId,
      entryId,
      sortIndex: attendeeIndex,
      name: toNullableString(attendee.name),
      email: toNullableString(attendee.email),
      role: toNullableString(attendee.role),
      status: toNullableString(attendee.status)
    });
    await tx.execute(SQL_INSERT_ATTENDEE, [
      dbAttendee.calendarId,
      dbAttendee.entryId,
      dbAttendee.sortIndex,
      dbAttendee.name,
      dbAttendee.email,
      dbAttendee.role,
      dbAttendee.status
    ]);
  }
}

function toCalendarProperties(calendar: DbDeviceCalendar): Record<string, unknown> | null {
  const properties = withoutNulls({
    credentialId: calendar.credentialId,
    createdManually: calendar.isCreatedManually ? true : null
  });
  return Object.keys(properties).length > 0 ? properties : null;
}

function toEntryProperties(calendar: DbDeviceCalendar, entry: DbDeviceCalendarEntry): Record<string, unknown> {
  return withoutNulls({
    credentialId: calendar.credentialId,
    url: entry.remoteUrl,
    etag: entry.etag,
    calendarDataParsed: entry.icalUid !== null ? { uid: entry.icalUid } : null
  });
}
