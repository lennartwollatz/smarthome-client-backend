import type { DeviceCalendarEntry } from "../../../../model/devices/DeviceCalendar.js";
import crypto from "node:crypto";

/**
 * Sehr einfacher iCalendar (ICS) Parser für VEVENT.
 * Reicht für SUMMARY/DTSTART/DTEND/UID/LOCATION/DESCRIPTION.
 *
 * Hinweis: Das ist bewusst minimal (keine Recurrence/Timezones vollumfänglich).
 */

export type ParsedVEvent = {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  categories?: string[];
  start?: Date;
  end?: Date;
  allDay?: boolean;
  lastModified?: Date;
  attendees?: Array<{ name?: string; email?: string; role?: string; status?: string }>;
  organizer?: { name?: string; email?: string };
  recurrenceRule?: string;
};

export function parseVEventFromIcs(ics: string): ParsedVEvent {
  const text = typeof ics === "string" ? ics : "";
  if (!text.includes("BEGIN:VEVENT")) return {};

  const lines = unfoldLines(text).split(/\r?\n/);
  let inEvent = false;

  let uid: string | undefined;
  let summary: string | undefined;
  let description: string | undefined;
  let location: string | undefined;
  let categories: string[] | undefined;
  let dtStartRaw: { value: string; params: Record<string, string> } | null = null;
  let dtEndRaw: { value: string; params: Record<string, string> } | null = null;
  let lastModifiedRaw: string | undefined;
  let attendees: Array<{ name?: string; email?: string; role?: string; status?: string }> = [];
  let organizer: { name?: string; email?: string } | undefined;
  let recurrenceRule: string | undefined;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      continue;
    }
    if (line === "END:VEVENT") {
      break;
    }
    if (!inEvent) continue;
    if (!line.trim()) continue;

    const parsed = parseProperty(line);
    if (!parsed) continue;
    const { name, params, value } = parsed;

    switch (name) {
      case "UID":
        uid = value;
        break;
      case "SUMMARY":
        summary = value;
        break;
      case "DESCRIPTION":
        description = value;
        break;
      case "LOCATION":
        location = value;
        break;
      case "CATEGORIES": {
        // CATEGORIES kann kommagetrennt sein
        const parts = String(value ?? "")
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);
        if (parts.length > 0) {
          categories = parts;
        }
        break;
      }
      case "DTSTART":
        dtStartRaw = { value, params };
        break;
      case "DTEND":
        dtEndRaw = { value, params };
        break;
      case "LAST-MODIFIED":
        lastModifiedRaw = value;
        break;
      case "ATTENDEE": {
        const attendee = parseAttendee(params, value);
        if (attendee) {
          attendees.push(attendee);
        }
        break;
      }
      case "ORGANIZER":
        organizer = parseOrganizer(params, value);
        break;
      case "RRULE":
        recurrenceRule = value;
        break;
    }
  }

  let start = dtStartRaw ? parseIcsDate(dtStartRaw.value, dtStartRaw.params) : null;
  let end = dtEndRaw ? parseIcsDate(dtEndRaw.value, dtEndRaw.params) : null;
  let allDay = start?.allDay || end?.allDay;
  const lastModified = parseIcsTimestamp(lastModifiedRaw);

  return {
    uid,
    summary,
    description,
    location,
    categories,
    start: start?.date,
    end: end?.date,
    allDay,
    lastModified,
    attendees: attendees.length > 0 ? attendees : undefined,
    organizer,
    recurrenceRule
  };
}

function unfoldLines(input: string) {
  // iCalendar line folding: CRLF + (space/tab) = continuation
  return input.replace(/\r?\n[ \t]/g, "");
}

function parseProperty(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const idx = line.indexOf(":");
  if (idx < 0) return null;
  const left = line.slice(0, idx);
  const value = unescapeIcsText(line.slice(idx + 1));

  const parts = left.split(";");
  const name = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    const k = p.slice(0, eq).toUpperCase();
    const v = p.slice(eq + 1);
    params[k] = v;
  }
  return { name, params, value };
}

function parseIcsDate(value: string, params: Record<string, string>): { date: Date; allDay: boolean } | null {
  const v = (value ?? "").trim();
  if (!v) return null;

  // All-day: VALUE=DATE und Format YYYYMMDD
  if (params?.VALUE === "DATE" || /^\d{8}$/.test(v)) {
    const y = Number(v.slice(0, 4));
    const m = Number(v.slice(4, 6)) - 1;
    const d = Number(v.slice(6, 8));
    const date = new Date(Date.UTC(y, m, d, 0, 0, 0));
    return { date, allDay: true };
  }

  // Date-time: YYYYMMDDTHHMMSSZ oder ohne Z
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = Number(m[6]);
  const isUtc = Boolean(m[7]);
  const date = isUtc ? new Date(Date.UTC(y, mo, d, hh, mm, ss)) : new Date(y, mo, d, hh, mm, ss);
  return { date, allDay: false };
}

function parseIcsTimestamp(value?: string): Date | undefined {
  const v = String(value ?? "").trim();
  if (!v) return undefined;

  const parsed = parseIcsDate(v, {});
  if (!parsed) return undefined;
  if (Number.isNaN(parsed.date.getTime())) return undefined;
  return parsed.date;
}

function unescapeIcsText(s: string) {
  return String(s ?? "")
    .replace(/\\n/gi, "\n")
    .replace(/\\\\/g, "\\")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";");
}

function parseAttendee(params: Record<string, string>, value: string): { name?: string; email?: string; role?: string; status?: string } | undefined {
  const name = normalizeParamValue(params.CN);
  const role = normalizeParamValue(params.ROLE);
  const status = normalizeParamValue(params.PARTSTAT);
  const emailFromParam = normalizeParamValue(params.EMAIL);
  const emailFromValue = extractMailto(value);
  const email = emailFromParam || emailFromValue;

  if (!name && !email && !role && !status) {
    return undefined;
  }
  return { name, email, role, status };
}

function parseOrganizer(params: Record<string, string>, value: string): { name?: string; email?: string } | undefined {
  const name = normalizeParamValue(params.CN);
  const emailFromParam = normalizeParamValue(params.EMAIL);
  const emailFromValue = extractMailto(value);
  const email = emailFromParam || emailFromValue;

  if (!name && !email) {
    return undefined;
  }
  return { name, email };
}

function extractMailto(value: string): string | undefined {
  const v = String(value ?? "").trim();
  if (!v) return undefined;
  const lower = v.toLowerCase();
  if (lower.startsWith("mailto:")) {
    return v.slice("mailto:".length).trim() || undefined;
  }
  return undefined;
}

function normalizeParamValue(value: string | undefined): string | undefined {
  const v = String(value ?? "").trim();
  if (!v) return undefined;
  if (v.startsWith("\"") && v.endsWith("\"") && v.length >= 2) {
    return v.slice(1, -1).trim() || undefined;
  }
  return v;
}

/**
 * Baut ein vollstaendiges VCALENDAR/VEVENT aus einem DeviceCalendarEntry.
 * Wird fuer CalDAV PUT (Update) verwendet.
 */
export function buildVCalendarFromEntry(entry: DeviceCalendarEntry): string {
  const uid = escapeIcsText(
    String(
      entry.properties?.calendarDataParsed?.uid ??
      entry.id ??
      crypto.randomUUID()
    )
  );
  const summary = escapeIcsText(entry.title ?? "");
  const dtstamp = toCaldavUtcStr(new Date());

  const start = new Date(entry.start);
  const end = new Date(entry.end);

  let dtstart: string;
  let dtend: string;

  if (entry.allDay) {
    // VALUE=DATE: YYYYMMDD
    dtstart = "DTSTART;VALUE=DATE:" + toDateOnly(start);
    dtend = "DTEND;VALUE=DATE:" + toDateOnly(end);
  } else {
    dtstart = "DTSTART:" + toCaldavUtcStr(start);
    dtend = "DTEND:" + toCaldavUtcStr(end);
  }

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//smarthome-backend//calendar-apple//DE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    dtstart,
    dtend,
    `SUMMARY:${summary}`
  ];


  if (entry.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(entry.description)}`);
  }
  if (entry.location) {
    lines.push(`LOCATION:${escapeIcsText(entry.location)}`);
  }
  if (entry.status) {
    lines.push(`STATUS:${escapeIcsText(entry.status)}`);
  }
  if (entry.url) {
    lines.push(`URL:${escapeIcsText(String(entry.url))}`);
  }
  if (entry.recurrenceRule) {
    lines.push(`RRULE:${String(entry.recurrenceRule).trim()}`);
  }
  if (entry.organizer) {
    const organizerLine = buildOrganizerLine(entry.organizer.name, entry.organizer.email);
    if (organizerLine) {
      lines.push(organizerLine);
    }
  }
  if (Array.isArray(entry.attendees)) {
    for (const attendee of entry.attendees) {
      const attendeeLine = buildAttendeeLine(attendee?.name, attendee?.email, attendee?.role, attendee?.status);
      if (attendeeLine) {
        lines.push(attendeeLine);
      }
    }
  }

  lines.push("END:VEVENT", "END:VCALENDAR", "");
  return lines.join("\r\n");
}

function escapeIcsText(s: string) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toCaldavUtcStr(d: Date) {
  const iso = d.toISOString();
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function toDateOnly(d: Date) {
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function buildOrganizerLine(name?: string, email?: string): string | undefined {
  const cn = String(name ?? "").trim();
  const mail = String(email ?? "").trim();
  if (!cn && !mail) return undefined;

  const params: string[] = [];
  if (cn) {
    params.push(`CN=${escapeIcsParam(cn)}`);
  }
  if (mail) {
    params.push(`EMAIL=${escapeIcsParam(mail)}`);
  }
  const paramText = params.length > 0 ? `;${params.join(";")}` : "";
  const value = mail ? `mailto:${mail}` : "";
  return `ORGANIZER${paramText}:${value}`;
}

function buildAttendeeLine(name?: string, email?: string, role?: string, status?: string): string | undefined {
  const cn = String(name ?? "").trim();
  const mail = String(email ?? "").trim();
  const attendeeRole = String(role ?? "").trim();
  const attendeeStatus = String(status ?? "").trim();
  if (!cn && !mail && !attendeeRole && !attendeeStatus) return undefined;

  const params: string[] = [];
  if (cn) {
    params.push(`CN=${escapeIcsParam(cn)}`);
  }
  if (attendeeRole) {
    params.push(`ROLE=${escapeIcsParam(attendeeRole)}`);
  }
  if (attendeeStatus) {
    params.push(`PARTSTAT=${escapeIcsParam(attendeeStatus)}`);
  }
  if (mail) {
    params.push(`EMAIL=${escapeIcsParam(mail)}`);
  }
  const paramText = params.length > 0 ? `;${params.join(";")}` : "";
  const value = mail ? `mailto:${mail}` : "";
  return `ATTENDEE${paramText}:${value}`;
}

function escapeIcsParam(s: string): string {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/:/g, "\\:")
    .replace(/\n/g, " ");
}


