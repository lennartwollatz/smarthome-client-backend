/**
 * Inspektions-Skript für die ML-Daten des DataCollectors.
 *
 * Liest ml_events, ml_snapshots und die zugehörigen Lookup-Tabellen
 * und gibt alles übersichtlich formatiert in der Konsole aus.
 *
 * Aufruf:  npx tsx inspectMlData.ts
 *
 * Der Server darf dabei NICHT laufen (SQLite-Lock).
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";

// ─── DB ──────────────────────────────────────────────────────────────────────

const dbPath = process.env.ML_DB_URL ?? "data/ml.sqlite";

if (!existsSync(dbPath)) {
  console.error(`ML-Datenbank nicht gefunden: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

// ─── Context-Bitfield dekodieren (identisch mit DataCollector.decodeCtx) ─────

const SEASON_NAMES = ["Frühling", "Sommer", "Herbst", "Winter"];
const WEEKDAY_NAMES = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function decodeCtx(ctx: number) {
  return {
    hour: ((ctx >>> 21) / 60) | 0,
    minute: (ctx >>> 21) % 60,
    weekday: (ctx >>> 18) & 0x7,
    isWorkday: !!((ctx >>> 17) & 0x1),
    season: (ctx >>> 15) & 0x3,
    dayOfMonth: (ctx >>> 10) & 0x1f,
    weekOfYear: (ctx >>> 4) & 0x3f,
    isDaylight: !!((ctx >>> 3) & 0x1),
  };
}

function formatCtx(ctx: number): string {
  const c = decodeCtx(ctx);
  const time = `${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;
  const wd = WEEKDAY_NAMES[c.weekday] ?? "??";
  const season = SEASON_NAMES[c.season] ?? "??";
  const workday = c.isWorkday ? "Werktag" : "Wochenende";
  const daylight = c.isDaylight ? "Tag" : "Nacht";
  return `${wd} ${c.dayOfMonth}. ${time} | KW${c.weekOfYear} | ${season} | ${workday} | ${daylight}`;
}

function formatTs(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

// ─── Tabelle drucken ─────────────────────────────────────────────────────────

function printTable(rows: Record<string, unknown>[], columns: string[], indent = 2) {
  if (rows.length === 0) {
    console.log(`${" ".repeat(indent)}(keine Einträge)\n`);
    return;
  }

  const pad = " ".repeat(indent);
  const colWidths = columns.map((col) => {
    const vals = rows.map((r) => String(r[col] ?? ""));
    return Math.max(col.length, ...vals.map((v) => v.length));
  });

  const header = columns.map((c, i) => c.padEnd(colWidths[i])).join("  │  ");
  const sep = colWidths.map((w) => "─".repeat(w)).join("──┼──");
  console.log(`${pad}${header}`);
  console.log(`${pad}${sep}`);
  for (const row of rows) {
    const line = columns
      .map((c, i) => String(row[c] ?? "").padEnd(colWidths[i]))
      .join("  │  ");
    console.log(`${pad}${line}`);
  }
  console.log();
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function tableExists(name: string): boolean {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name=?")
    .get(name) as { c: number } | undefined;
  return (row?.c ?? 0) > 0;
}

function queryCount(table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
}

function columnExists(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║       ML-Daten Inspektion (DataCollector)        ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`Datenbank: ${path.resolve(dbPath)}\n`);

  const requiredTables = [
    "l_device_types", "l_rooms", "l_modules",
    "l_event_types", "l_devices",
    "ml_events", "ml_snapshots",
  ];

  const missing = requiredTables.filter((t) => !tableExists(t));
  if (missing.length > 0) {
    console.error(`Fehlende Tabellen: ${missing.join(", ")}`);
    console.error("Wurde der DataCollector jemals gestartet?");
    db.close();
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Zusammenfassung
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("┌──────────────────────────────────────────────────┐");
  console.log("│ Zusammenfassung                                  │");
  console.log("└──────────────────────────────────────────────────┘\n");

  const eventsCount = queryCount("ml_events");
  const snapshotsCount = queryCount("ml_snapshots");
  const devicesCount = queryCount("l_devices");
  const eventTypesCount = queryCount("l_event_types");
  const deviceTypesCount = queryCount("l_device_types");
  const roomsCount = queryCount("l_rooms");
  const modulesCount = queryCount("l_modules");

  console.log(`  ml_events       : ${eventsCount}`);
  console.log(`  ml_snapshots    : ${snapshotsCount}`);
  console.log(`  l_devices       : ${devicesCount}`);
  console.log(`  l_event_types   : ${eventTypesCount}`);
  console.log(`  l_device_types  : ${deviceTypesCount}`);
  console.log(`  l_rooms         : ${roomsCount}`);
  console.log(`  l_modules       : ${modulesCount}`);
  console.log();

  if (eventsCount > 0) {
    const range = db.prepare(
      "SELECT MIN(ts) AS first, MAX(ts) AS last FROM ml_events"
    ).get() as { first: number; last: number };
    console.log(`  Zeitraum Events : ${formatTs(range.first)} → ${formatTs(range.last)}`);
  }
  if (snapshotsCount > 0) {
    const range = db.prepare(
      "SELECT MIN(ts) AS first, MAX(ts) AS last FROM ml_snapshots"
    ).get() as { first: number; last: number };
    console.log(`  Zeitraum Snaps  : ${formatTs(range.first)} → ${formatTs(range.last)}`);
  }
  console.log();

  // ═══════════════════════════════════════════════════════════════════════════
  // Lookup: Event-Typen
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("┌──────────────────────────────────────────────────┐");
  console.log("│ Event-Typen (l_event_types)                      │");
  console.log("└──────────────────────────────────────────────────┘\n");

  const eventTypes = db.prepare(
    "SELECT etid, name FROM l_event_types ORDER BY etid"
  ).all() as { etid: number; name: string }[];
  printTable(eventTypes, ["etid", "name"]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Lookup: Gerätetypen
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("┌──────────────────────────────────────────────────┐");
  console.log("│ Gerätetypen (l_device_types)                     │");
  console.log("└──────────────────────────────────────────────────┘\n");

  const deviceTypes = db.prepare(
    "SELECT dtid, name FROM l_device_types ORDER BY dtid"
  ).all() as { dtid: number; name: string }[];
  printTable(deviceTypes, ["dtid", "name"]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Lookup: Räume
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("┌──────────────────────────────────────────────────┐");
  console.log("│ Räume (l_rooms)                                  │");
  console.log("└──────────────────────────────────────────────────┘\n");

  const rooms = db.prepare(
    "SELECT rid, name FROM l_rooms ORDER BY rid"
  ).all() as { rid: number; name: string }[];
  printTable(rooms, ["rid", "name"]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Lookup: Module
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("┌──────────────────────────────────────────────────┐");
  console.log("│ Module (l_modules)                               │");
  console.log("└──────────────────────────────────────────────────┘\n");

  const modules = db.prepare(
    "SELECT mid, name FROM l_modules ORDER BY mid"
  ).all() as { mid: number; name: string }[];
  printTable(modules, ["mid", "name"]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Lookup: Geräte
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("┌──────────────────────────────────────────────────┐");
  console.log("│ Registrierte Geräte (l_devices)                  │");
  console.log("└──────────────────────────────────────────────────┘\n");

  const devices = db.prepare(`
    SELECT d.did, d.device_id,
           COALESCE(dt.name, '?') AS device_type,
           COALESCE(r.name, '-')  AS room,
           COALESCE(m.name, '-')  AS module
    FROM l_devices d
    LEFT JOIN l_device_types dt ON dt.dtid = d.device_type
    LEFT JOIN l_rooms r ON r.rid = d.room
    LEFT JOIN l_modules m ON m.mid = d.module_id
    ORDER BY d.did
  `).all() as Record<string, unknown>[];
  printTable(devices, ["did", "device_id", "device_type", "room", "module"]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Events pro Gerät
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("┌──────────────────────────────────────────────────┐");
  console.log("│ Events pro Gerät                                 │");
  console.log("└──────────────────────────────────────────────────┘\n");

  const eventsPerDevice = db.prepare(`
    SELECT d.device_id, COALESCE(dt.name, '?') AS device_type,
           COUNT(*) AS events,
           MIN(e.ts) AS first_ts, MAX(e.ts) AS last_ts
    FROM ml_events e
    JOIN l_devices d ON d.did = e.did
    LEFT JOIN l_device_types dt ON dt.dtid = d.device_type
    GROUP BY e.did
    ORDER BY events DESC
  `).all() as { device_id: string; device_type: string; events: number; first_ts: number; last_ts: number }[];

  const evtDevRows = eventsPerDevice.map((r) => ({
    device_id: r.device_id,
    device_type: r.device_type,
    events: String(r.events),
    erster: formatTs(r.first_ts),
    letzter: formatTs(r.last_ts),
  }));
  printTable(evtDevRows, ["device_id", "device_type", "events", "erster", "letzter"]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Events pro Event-Typ
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("┌──────────────────────────────────────────────────┐");
  console.log("│ Events pro Event-Typ                             │");
  console.log("└──────────────────────────────────────────────────┘\n");

  const eventsPerType = db.prepare(`
    SELECT COALESCE(et.name, CAST(e.et AS TEXT)) AS event_type, COUNT(*) AS count
    FROM ml_events e
    LEFT JOIN l_event_types et ON et.etid = e.et
    GROUP BY e.et
    ORDER BY count DESC
  `).all() as { event_type: string; count: number }[];

  printTable(
    eventsPerType.map((r) => ({ event_type: r.event_type, count: String(r.count) })),
    ["event_type", "count"],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Letzte 50 Events (Detail)
  // ═══════════════════════════════════════════════════════════════════════════
  const RECENT_LIMIT = 50;
  console.log("┌──────────────────────────────────────────────────┐");
  console.log(`│ Letzte ${RECENT_LIMIT} Events (neueste zuerst)                │`);
  console.log("└──────────────────────────────────────────────────┘\n");

  const hasPrs = columnExists("ml_events", "prs");
  const hasCal = columnExists("ml_events", "cal");
  const hasScn = columnExists("ml_events", "scn");

  const optionalCols = [
    hasPrs ? "e.prs" : "NULL AS prs",
    hasCal ? "e.cal" : "NULL AS cal",
    hasScn ? "e.scn" : "NULL AS scn",
  ].join(", ");

  const recentEvents = db.prepare(`
    SELECT e.id, e.ts, d.device_id,
           COALESCE(et.name, CAST(e.et AS TEXT)) AS event_type,
           e.src, e.s, e.ctx, ${optionalCols}
    FROM ml_events e
    JOIN l_devices d ON d.did = e.did
    LEFT JOIN l_event_types et ON et.etid = e.et
    ORDER BY e.ts DESC, e.id DESC
    LIMIT ?
  `).all(RECENT_LIMIT) as {
    id: number; ts: number; device_id: string; event_type: string;
    src: number; s: string | null; ctx: number;
    prs: string | null; cal: string | null; scn: string | null;
  }[];

  for (const ev of recentEvents) {
    console.log(`  ── Event #${ev.id} ──────────────────────────────────`);
    console.log(`  Zeit       : ${formatTs(ev.ts)}`);
    console.log(`  Gerät      : ${ev.device_id}`);
    console.log(`  Event-Typ  : ${ev.event_type}`);
    console.log(`  Kontext    : ${formatCtx(ev.ctx)}`);

    if (ev.s) {
      try {
        const state = JSON.parse(ev.s);
        const compact = JSON.stringify(state, null, 2)
          .split("\n")
          .map((l) => `               ${l}`)
          .join("\n");
        console.log(`  State      :\n${compact}`);
      } catch {
        console.log(`  State      : ${ev.s.slice(0, 200)}`);
      }
    }

    if (ev.prs) {
      try {
        const prs = JSON.parse(ev.prs);
        console.log(`  Anwesenheit: ${prs.h ?? 0} zuhause, ${prs.a ?? 0} abwesend`);
      } catch { /* skip */ }
    }

    if (ev.cal && ev.cal !== "{}") {
      try {
        const cal = JSON.parse(ev.cal);
        const parts: string[] = [`${cal.td ?? 0} Termine heute`];
        if (cal.cur) parts.push(`aktuell: "${cal.cur.t}" (noch ${cal.cur.rem} min)`);
        if (cal.nxt) parts.push(`nächster: "${cal.nxt.t}" (in ${cal.nxt.in} min)`);
        console.log(`  Kalender   : ${parts.join(" | ")}`);
      } catch { /* skip */ }
    }

    if (ev.scn) {
      try {
        const scn = JSON.parse(ev.scn);
        if (Array.isArray(scn) && scn.length > 0) {
          console.log(`  Szenen     : ${scn.join(", ")}`);
        }
      } catch { /* skip */ }
    }

    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Letzte 30 Snapshots
  // ═══════════════════════════════════════════════════════════════════════════
  const SNAP_LIMIT = 30;
  console.log("┌──────────────────────────────────────────────────┐");
  console.log(`│ Letzte ${SNAP_LIMIT} Snapshots (neueste zuerst)             │`);
  console.log("└──────────────────────────────────────────────────┘\n");

  const recentSnaps = db.prepare(`
    SELECT s.ts, d.device_id, s.s, s.ctx
    FROM ml_snapshots s
    JOIN l_devices d ON d.did = s.did
    ORDER BY s.ts DESC
    LIMIT ?
  `).all(SNAP_LIMIT) as { ts: number; device_id: string; s: string; ctx: number }[];

  for (const snap of recentSnaps) {
    console.log(`  ── Snapshot ──────────────────────────────────────`);
    console.log(`  Zeit    : ${formatTs(snap.ts)}`);
    console.log(`  Gerät   : ${snap.device_id}`);
    console.log(`  Kontext : ${formatCtx(snap.ctx)}`);
    try {
      const state = JSON.parse(snap.s);
      const compact = JSON.stringify(state, null, 2)
        .split("\n")
        .map((l) => `            ${l}`)
        .join("\n");
      console.log(`  State   :\n${compact}`);
    } catch {
      console.log(`  State   : ${snap.s.slice(0, 200)}`);
    }
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Events-Verteilung nach Stunde
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("┌──────────────────────────────────────────────────┐");
  console.log("│ Events-Verteilung nach Tagesstunde               │");
  console.log("└──────────────────────────────────────────────────┘\n");

  const hourDist = db.prepare(`
    SELECT (ts % 86400) / 3600 AS hour, COUNT(*) AS count
    FROM ml_events
    GROUP BY hour
    ORDER BY hour
  `).all() as { hour: number; count: number }[];

  if (hourDist.length > 0) {
    const maxCount = Math.max(...hourDist.map((h) => h.count));
    const BAR_WIDTH = 40;
    const hourMap = new Map(hourDist.map((h) => [h.hour, h.count]));

    for (let h = 0; h < 24; h++) {
      const count = hourMap.get(h) ?? 0;
      const barLen = maxCount > 0 ? Math.round((count / maxCount) * BAR_WIDTH) : 0;
      const bar = "█".repeat(barLen);
      console.log(`  ${String(h).padStart(2, "0")}:00  ${bar.padEnd(BAR_WIDTH)}  ${count}`);
    }
    console.log();
  } else {
    console.log("  (keine Events vorhanden)\n");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  db.close();
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║          Inspektion abgeschlossen                ║");
  console.log("╚══════════════════════════════════════════════════╝");
}

main();
