import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DeviceManager } from "../api/entities/devices/deviceManager.js";
import { SettingManager } from "../api/entities/settings/settingManager.js";
import { UserManager } from "../api/entities/users/userManager.js";
import { SceneManager } from "../api/entities/scenes/sceneManager.js";
import { Event } from "../events/events/Event.js";
import { EventType } from "../events/event-types/EventType.js";
import { EventSource } from "../events/EventSource.js";
import { Device } from "../../model/devices/Device.js";
import { DeviceType } from "../../model/devices/helper/DeviceType.js";
import { logger } from "../../logger.js";

type DB = InstanceType<typeof Database>;

export class DataCollector {
  private db: DB;
  private deviceManager: DeviceManager;
  private settingManager: SettingManager;
  private userManager: UserManager;
  private sceneManager: SceneManager;

  private deviceIdMap = new Map<string, number>();
  private eventTypeMap = new Map<string, number>();
  private deviceTypeMap = new Map<string, number>();
  private roomMap = new Map<string, number>();
  private moduleMap = new Map<string, number>();

  private readonly SQL_INSERT_SNAPSHOT =
    "INSERT OR REPLACE INTO ml_snapshots (ts, did, s, ctx) VALUES (?, ?, ?, ?)";
  private readonly SQL_INSERT_EVENT =
    "INSERT INTO ml_events (ts, did, et, src, s, env, ctx, prs, cal, scn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

  private lastState = new Map<number, string>();
  private periodicTimer?: ReturnType<typeof setInterval>;
  /**
   * Pro Event würde sonst {@link buildEnvironment} (alle Geräte als JSON) + Kontexte neu gebaut —
   * bei vielen Events/Sek. massiver Speicher- und CPU-Druck (Heap-OOM). Kurzlebig cachen.
   */
  private mlContextCache: { atMs: number; env: string; prs: string; cal: string; scn: string } | null = null;
  private static readonly ML_CONTEXT_CACHE_TTL_MS = 3_000;

  /**
   * Klassen-Geräte: {@link Device.toDatabaseJson}; aus der DB geladene Plain-Objects haben diese Methode nicht.
   */
  private snapshotDeviceForMl(device: Device): Record<string, unknown> {
    const d = device as unknown as {
      toDatabaseJson?: () => Record<string, unknown>;
      toJSON?: () => Record<string, unknown>;
    };
    if (typeof d.toDatabaseJson === "function") {
      return d.toDatabaseJson();
    }
    if (typeof d.toJSON === "function") {
      return d.toJSON();
    }
    try {
      return JSON.parse(JSON.stringify(device)) as Record<string, unknown>;
    } catch {
      return { id: (device as { id?: string }).id };
    }
  }

  private static readonly PERIODIC_TYPES = new Set([
    "temperature",
    "weather",
    "light-level",
    "motion-light-level-temperature",
    "thermostat",
  ]);
  private static readonly PERIODIC_INTERVAL_MS = 10 * 60 * 1000;

  constructor(
    mlDbPath: string,
    deviceManager: DeviceManager,
    settingManager: SettingManager,
    userManager: UserManager,
    sceneManager: SceneManager,
  ) {
    const dir = path.dirname(mlDbPath);
    if (dir && dir !== "." && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(mlDbPath);
    this.db.pragma("journal_mode = WAL");

    this.deviceManager = deviceManager;
    this.settingManager = settingManager;
    this.userManager = userManager;
    this.sceneManager = sceneManager;

    this.initSchema();
    this.migrateSchema();
    this.syncLookups();
    this.startPeriodicSnapshots();

    logger.info({ mlDbPath }, "DataCollector initialisiert (separate DB)");
  }

  /* ─── Schema ──────────────────────────────────────── */

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS l_device_types (
        dtid INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS l_rooms (
        rid  INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS l_modules (
        mid  INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS l_event_types (
        etid INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS l_devices (
        did        INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id  TEXT    NOT NULL UNIQUE,
        device_type INTEGER NOT NULL REFERENCES l_device_types(dtid),
        room       INTEGER REFERENCES l_rooms(rid),
        module_id  INTEGER REFERENCES l_modules(mid)
      );

      CREATE TABLE IF NOT EXISTS ml_snapshots (
        ts  INTEGER NOT NULL,
        did INTEGER NOT NULL,
        s   TEXT    NOT NULL,
        ctx INTEGER NOT NULL,
        PRIMARY KEY (ts, did)
      ) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS idx_mlsnap_did ON ml_snapshots(did, ts);

      CREATE TABLE IF NOT EXISTS ml_events (
        id  INTEGER PRIMARY KEY AUTOINCREMENT,
        ts  INTEGER NOT NULL,
        did INTEGER NOT NULL,
        et  INTEGER NOT NULL,
        src INTEGER NOT NULL DEFAULT 0,
        s   TEXT,
        env TEXT,
        ctx INTEGER NOT NULL,
        prs TEXT,
        cal TEXT,
        scn TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_mlev_ts  ON ml_events(ts);
      CREATE INDEX IF NOT EXISTS idx_mlev_did ON ml_events(did, ts);
    `);
    logger.info("ML-Schema initialisiert");
  }

  private migrateSchema(): void {
    const cols = this.db
      .prepare("PRAGMA table_info(ml_events)")
      .all() as { name: string }[];
    const existing = new Set(cols.map((c) => c.name));
    if (!existing.has("prs")) {
      this.db.exec("ALTER TABLE ml_events ADD COLUMN prs TEXT");
    }
    if (!existing.has("cal")) {
      this.db.exec("ALTER TABLE ml_events ADD COLUMN cal TEXT");
    }
    if (!existing.has("scn")) {
      this.db.exec("ALTER TABLE ml_events ADD COLUMN scn TEXT");
    }
  }

  /* ─── Lookup Sync ─────────────────────────────────── */

  private syncLookups(): void {
    const insertET = this.db.prepare(
      "INSERT OR IGNORE INTO l_event_types (name) VALUES (?)"
    );
    this.db.transaction(() => {
      for (const val of Object.values(EventType)) {
        insertET.run(val);
      }
    })();

    this.eventTypeMap.clear();
    for (const r of this.db
      .prepare("SELECT etid, name FROM l_event_types")
      .all() as { etid: number; name: string }[]) {
      this.eventTypeMap.set(r.name, r.etid);
    }

    this.syncDevices();

    logger.info(
      { eventTypes: this.eventTypeMap.size, devices: this.deviceIdMap.size },
      "Lookup-Tabellen synchronisiert"
    );
  }

  syncDevices(): void {
    const insertDT = this.db.prepare(
      "INSERT OR IGNORE INTO l_device_types (name) VALUES (?)"
    );
    const insertRoom = this.db.prepare(
      "INSERT OR IGNORE INTO l_rooms (name) VALUES (?)"
    );
    const insertModule = this.db.prepare(
      "INSERT OR IGNORE INTO l_modules (name) VALUES (?)"
    );
    const upsertDevice = this.db.prepare(`
      INSERT INTO l_devices (device_id, device_type, room, module_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET
        device_type = excluded.device_type,
        room        = excluded.room,
        module_id   = excluded.module_id
    `);

    this.db.transaction(() => {
      for (const device of this.deviceManager.getDevices()) {
        insertDT.run(device.type ?? "unknown");
        if (device.room) insertRoom.run(device.room);
        if (device.moduleId) insertModule.run(device.moduleId);
      }

      this.reloadLookupCaches();

      for (const device of this.deviceManager.getDevices()) {
        const dtid = this.deviceTypeMap.get(device.type ?? "unknown") ?? 0;
        const rid = device.room
          ? (this.roomMap.get(device.room) ?? null)
          : null;
        const mid = device.moduleId
          ? (this.moduleMap.get(device.moduleId) ?? null)
          : null;
        upsertDevice.run(device.id, dtid, rid, mid);
      }

      this.deviceIdMap.clear();
      for (const r of this.db
        .prepare("SELECT did, device_id FROM l_devices")
        .all() as { did: number; device_id: string }[]) {
        this.deviceIdMap.set(r.device_id, r.did);
      }
    })();
  }

  private reloadLookupCaches(): void {
    this.deviceTypeMap.clear();
    for (const r of this.db
      .prepare("SELECT dtid, name FROM l_device_types")
      .all() as { dtid: number; name: string }[]) {
      this.deviceTypeMap.set(r.name, r.dtid);
    }
    this.roomMap.clear();
    for (const r of this.db
      .prepare("SELECT rid, name FROM l_rooms")
      .all() as { rid: number; name: string }[]) {
      this.roomMap.set(r.name, r.rid);
    }
    this.moduleMap.clear();
    for (const r of this.db
      .prepare("SELECT mid, name FROM l_modules")
      .all() as { mid: number; name: string }[]) {
      this.moduleMap.set(r.name, r.mid);
    }
  }

  private insertSnapshot(ts: number, did: number, s: string, ctx: number): void {
    this.db.prepare(this.SQL_INSERT_SNAPSHOT).run(ts, did, s, ctx);
  }

  private insertEvent(
    ts: number, did: number, et: number, src: number,
    s: string, env: string, ctx: number,
    prs: string, cal: string, scn: string,
  ): void {
    this.db.prepare(this.SQL_INSERT_EVENT).run(
      ts, did, et, src, s, env, ctx, prs, cal, scn,
    );
  }

  /* ─── Event Handler (called by EventManager) ──────── */

  onEvent(event: Event): void {
    if (!this.isAiLearningEnabled()) return;
    if (!event.mlcollect) return;
    try {
      const did = this.resolveDevice(event.deviceId);
      if (did === null) return;

      const now = new Date(event.timestamp);
      const ts = Math.floor(event.timestamp / 1000);
      const sunTimes = this.getSunTimes();
      const ctx = DataCollector.encodeCtx(now, sunTimes);
      const etid = this.eventTypeMap.get(event.eventType) ?? 0;

      const device = this.deviceManager.getDevice(event.deviceId);
      const stateJson = device
        ? JSON.stringify(this.snapshotDeviceForMl(device as Device))
        : "{}";

      const { env, prs, cal, scn } = this.getOrBuildSharedMlContext(now);

      const src = event.source ?? EventSource.SYSTEM;
      this.insertEvent(ts, did, etid, src, stateJson, env, ctx, prs, cal, scn);

      const lastJson = this.lastState.get(did);
      if (lastJson !== stateJson) {
        this.insertSnapshot(ts, did, stateJson, ctx);
        this.lastState.set(did, stateJson);
      }
    } catch (err) {
      logger.error({ err }, "DataCollector: Fehler beim Event-Logging");
    }
  }

  private getOrBuildSharedMlContext(now: Date): { env: string; prs: string; cal: string; scn: string } {
    const t = Date.now();
    if (
      this.mlContextCache &&
      t - this.mlContextCache.atMs < DataCollector.ML_CONTEXT_CACHE_TTL_MS
    ) {
      return {
        env: this.mlContextCache.env,
        prs: this.mlContextCache.prs,
        cal: this.mlContextCache.cal,
        scn: this.mlContextCache.scn,
      };
    }
    const env = this.buildEnvironment();
    const prs = this.buildPresenceContext();
    const cal = this.buildCalendarContext(now);
    const scn = this.buildScenesContext();
    this.mlContextCache = { atMs: t, env, prs, cal, scn };
    return { env, prs, cal, scn };
  }

  /* ─── Environment Snapshot ────────────────────────── */

  private buildEnvironment(): string {
    const env: Record<number, unknown> = {};
    for (const device of this.deviceManager.getDevices()) {
      const did = this.deviceIdMap.get(device.id);
      if (did == null) continue;
      env[did] = this.snapshotDeviceForMl(device as Device);
    }
    return JSON.stringify(env);
  }

  /* ─── 1) Nutzer-Anwesenheit ───────────────────────── */

  private buildPresenceContext(): string {
    const users = this.userManager.findAll();
    const u: Record<string, number> = {};
    let home = 0;
    let away = 0;
    for (const user of users) {
      const p = user.present ? 1 : 0;
      u[user.id] = p;
      if (p) home++;
      else away++;
    }
    return JSON.stringify({ h: home, a: away, u });
  }

  /* ─── 2) Kalender-Kontext ─────────────────────────── */

  private buildCalendarContext(now: Date): string {
    const calDevice = this.deviceManager.getDevice("calendar-device") as
      | { getCurrentEntry(d: Date): { title: string; location?: string; start: string; end: string; allDay?: boolean } | null;
          getNextEntry(d: Date): { title: string; start: string; allDay?: boolean } | undefined;
          hasEntriesToday(d: Date): boolean;
          calendars?: { entries: unknown[] }[];
        }
      | null;

    if (!calDevice) return "{}";

    const nowMs = now.getTime();
    const cur = calDevice.getCurrentEntry?.(now);
    const nxt = calDevice.getNextEntry?.(now);

    const todayCount =
      calDevice.calendars?.reduce((s, c) => {
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(now);
        dayEnd.setHours(23, 59, 59, 999);
        return (
          s +
          c.entries.filter((e: any) => {
            const es = new Date(e.start).getTime();
            const ee = new Date(e.end).getTime();
            return es <= dayEnd.getTime() && ee >= dayStart.getTime();
          }).length
        );
      }, 0) ?? 0;

    const result: Record<string, unknown> = { td: todayCount };

    if (cur) {
      const remMin = Math.max(
        0,
        Math.round((new Date(cur.end).getTime() - nowMs) / 60_000)
      );
      result.cur = {
        t: cur.title,
        loc: cur.location ?? null,
        ad: cur.allDay ? 1 : 0,
        rem: remMin,
      };
    }
    if (nxt) {
      const inMin = Math.max(
        0,
        Math.round((new Date(nxt.start).getTime() - nowMs) / 60_000)
      );
      result.nxt = {
        t: nxt.title,
        in: inMin,
        ad: nxt.allDay ? 1 : 0,
      };
    }
    return JSON.stringify(result);
  }

  /* ─── 3) Aktive Szenen ────────────────────────────── */

  private buildScenesContext(): string {
    const scenes = this.sceneManager.getScenes();
    const active = scenes
      .filter((s) => s.active && s.id)
      .map((s) => s.id!);
    return JSON.stringify(active);
  }

  /* ─── 4) Sunrise / Sunset ─────────────────────────── */

  private getSunTimes(): { srMin: number; ssMin: number } | null {
    for (const device of this.deviceManager.getDevices()) {
      if (device.type !== DeviceType.WEATHER) continue;
      const w = device as unknown as { sunrise?: string; sunset?: string };
      if (!w.sunrise || !w.sunset) continue;
      const sr = new Date(w.sunrise);
      const ss = new Date(w.sunset);
      if (isNaN(sr.getTime()) || isNaN(ss.getTime())) continue;
      return {
        srMin: sr.getHours() * 60 + sr.getMinutes(),
        ssMin: ss.getHours() * 60 + ss.getMinutes(),
      };
    }
    return null;
  }

  /* ─── Periodic Snapshots (Strategie B) ────────────── */

  private startPeriodicSnapshots(): void {
    this.periodicTimer = setInterval(() => {
      this.writePeriodicSnapshots();
    }, DataCollector.PERIODIC_INTERVAL_MS);
  }

  private writePeriodicSnapshots(): void {
    if (!this.isAiLearningEnabled()) return;
    try {
      this.syncDevices();

      const ts = Math.floor(Date.now() / 1000);
      const ctx = DataCollector.encodeCtx(new Date(), this.getSunTimes());

      this.db.transaction(() => {
        for (const device of this.deviceManager.getDevices()) {
          if (!DataCollector.PERIODIC_TYPES.has(device.type ?? "")) continue;
          const did = this.deviceIdMap.get(device.id);
          if (did == null) continue;
          const stateJson = JSON.stringify(this.snapshotDeviceForMl(device as Device));
          this.insertSnapshot(ts, did, stateJson, ctx);
          this.lastState.set(did, stateJson);
        }
      })();
    } catch (err) {
      logger.error({ err }, "DataCollector: Fehler bei periodischen Snapshots");
    }
  }

  /* ─── Helpers ─────────────────────────────────────── */

  private isAiLearningEnabled(): boolean {
    const settings = this.settingManager.loadOrCreateSettings();
    const privacy = settings.privacy as { ailearning?: boolean } | undefined;
    return privacy?.ailearning === true;
  }

  private resolveDevice(deviceId: string): number | null {
    let did = this.deviceIdMap.get(deviceId);
    if (did != null) return did;
    this.syncDevices();
    did = this.deviceIdMap.get(deviceId);
    if (did == null) {
      logger.warn({ deviceId }, "DataCollector: Device nicht auflösbar");
    }
    return did ?? null;
  }

  /* ─── Context Bitfield (32-Bit) ───────────────────── */

  static encodeCtx(
    d: Date,
    sunTimes?: { srMin: number; ssMin: number } | null,
  ): number {
    const minuteOfDay = d.getHours() * 60 + d.getMinutes();
    const wday = d.getDay();
    const isWorkday = wday >= 1 && wday <= 5 ? 1 : 0;
    const month = d.getMonth();
    const season =
      month >= 2 && month <= 4
        ? 0
        : month >= 5 && month <= 7
          ? 1
          : month >= 8 && month <= 10
            ? 2
            : 3;
    const dom = d.getDate();
    const woy = DataCollector.getWeekOfYear(d);
    const isDaylight =
      sunTimes != null
        ? minuteOfDay >= sunTimes.srMin && minuteOfDay < sunTimes.ssMin
          ? 1
          : 0
        : 0;

    return (
      (minuteOfDay << 21) |
      (wday << 18) |
      (isWorkday << 17) |
      (season << 15) |
      (dom << 10) |
      (woy << 4) |
      (isDaylight << 3)
    );
  }

  static decodeCtx(ctx: number) {
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

  private static getWeekOfYear(d: Date): number {
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const dayOfYear =
      Math.floor((d.getTime() - jan1.getTime()) / 86_400_000) + 1;
    const jan1Day = jan1.getDay() || 7;
    return Math.ceil((dayOfYear + jan1Day - 1) / 7);
  }

  /* ─── Datenlöschung (Datenschutz) ───────────────── */

  clearMlData(): void {
    this.db.exec("DELETE FROM ml_events");
    this.db.exec("DELETE FROM ml_snapshots");
    this.lastState.clear();
    logger.info("ML-Daten (Events + Snapshots) gelöscht");
  }

  /* ─── Lifecycle ───────────────────────────────────── */

  destroy(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = undefined;
    }
    this.db.close();
    logger.info("DataCollector gestoppt, ML-DB geschlossen");
  }
}
