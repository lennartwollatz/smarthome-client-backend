import type { RowDataPacket } from "mysql2/promise";
import { DbHomeSettings } from "../../model/db/DbHomeSettings.js";
import type { Settings } from "../../model/Settings.js";
import type { DatabaseManager } from "../database.js";
import { fromNullable, toBoolean, toStringParam } from "../sqlValues.js";

/** Die Tabelle enthält höchstens diese eine Zeile (CHECK id = 1). */
const HOME_SETTINGS_ID = 1;

const SQL_SELECT_HOME_SETTINGS = `
  SELECT
      hs.id,
      hs.home_name                            AS homeName,
      hs.language,
      hs.temperature_unit                     AS temperatureUnit,
      hs.security_notifications_enabled       AS securityNotificationsEnabled,
      hs.battery_status_notifications_enabled AS batteryStatusNotificationsEnabled,
      hs.energy_report_notifications_enabled  AS energyReportNotificationsEnabled,
      hs.ai_learning_enabled                  AS aiLearningEnabled,
      hs.auto_update_enabled                  AS autoUpdateEnabled,
      hs.auto_update_time_from                AS autoUpdateTimeFrom,
      hs.auto_update_time_to                  AS autoUpdateTimeTo
  FROM home_settings AS hs
  WHERE hs.id = ?`;

const SQL_UPSERT_HOME_SETTINGS = `
  INSERT INTO home_settings (
      id, home_name, language, temperature_unit,
      security_notifications_enabled, battery_status_notifications_enabled, energy_report_notifications_enabled,
      ai_learning_enabled, auto_update_enabled, auto_update_time_from, auto_update_time_to
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      home_name                            = incoming.home_name,
      language                             = incoming.language,
      temperature_unit                     = incoming.temperature_unit,
      security_notifications_enabled       = incoming.security_notifications_enabled,
      battery_status_notifications_enabled = incoming.battery_status_notifications_enabled,
      energy_report_notifications_enabled  = incoming.energy_report_notifications_enabled,
      ai_learning_enabled                  = incoming.ai_learning_enabled,
      auto_update_enabled                  = incoming.auto_update_enabled,
      auto_update_time_from                = incoming.auto_update_time_from,
      auto_update_time_to                  = incoming.auto_update_time_to`;

/**
 * Einstellungen als einzelne Zeile mit einer Spalte je Wert.
 * system.frontend/backend/serverIp werden bei jedem Laden neu berechnet und nicht gespeichert.
 */
export class SettingsRepository {
  constructor(private readonly db: DatabaseManager) {}

  async load(): Promise<Settings | null> {
    const [row] = await this.db.query<RowDataPacket>(SQL_SELECT_HOME_SETTINGS, [HOME_SETTINGS_ID]);
    return row ? toSettings(toDbHomeSettings(row)) : null;
  }

  /** Ersetzt alle gespeicherten Werte; fehlende Werte werden zu NULL. */
  async save(settings: Settings): Promise<void> {
    const dbSettings = fromSettings(settings);
    await this.db.execute(SQL_UPSERT_HOME_SETTINGS, [
      dbSettings.id,
      dbSettings.homeName,
      dbSettings.language,
      dbSettings.temperatureUnit,
      dbSettings.securityNotificationsEnabled,
      dbSettings.batteryStatusNotificationsEnabled,
      dbSettings.energyReportNotificationsEnabled,
      dbSettings.aiLearningEnabled,
      dbSettings.autoUpdateEnabled,
      dbSettings.autoUpdateTimeFrom,
      dbSettings.autoUpdateTimeTo
    ]);
  }
}

function toBooleanParam(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toNullableBoolean(value: unknown): boolean | null {
  return value === null || value === undefined ? null : toBoolean(value);
}

/** MySQL liefert TIME als `HH:MM:SS`; Frontend und API verwenden `HH:mm`. */
function toClockTime(value: string | null): string | undefined {
  return value === null ? undefined : value.slice(0, 5);
}

/** Entfernt undefined-Werte; liefert undefined, wenn kein Wert übrig bleibt. */
function compact<T extends object>(values: T): T | undefined {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}

function toDbHomeSettings(row: RowDataPacket): DbHomeSettings {
  return new DbHomeSettings({
    id: row.id,
    homeName: row.homeName,
    language: row.language,
    temperatureUnit: row.temperatureUnit,
    securityNotificationsEnabled: toNullableBoolean(row.securityNotificationsEnabled),
    batteryStatusNotificationsEnabled: toNullableBoolean(row.batteryStatusNotificationsEnabled),
    energyReportNotificationsEnabled: toNullableBoolean(row.energyReportNotificationsEnabled),
    aiLearningEnabled: toNullableBoolean(row.aiLearningEnabled),
    autoUpdateEnabled: toNullableBoolean(row.autoUpdateEnabled),
    autoUpdateTimeFrom: row.autoUpdateTimeFrom,
    autoUpdateTimeTo: row.autoUpdateTimeTo
  });
}

function toSettings(dbSettings: DbHomeSettings): Settings {
  const settings: Settings = {};
  settings.allgemein = compact({
    name: fromNullable(dbSettings.homeName),
    sprache: fromNullable(dbSettings.language),
    temperatur: fromNullable(dbSettings.temperatureUnit)
  });
  settings.notifications = compact({
    security: fromNullable(dbSettings.securityNotificationsEnabled),
    batterystatus: fromNullable(dbSettings.batteryStatusNotificationsEnabled),
    energyreport: fromNullable(dbSettings.energyReportNotificationsEnabled)
  });
  settings.privacy = compact({
    ailearning: fromNullable(dbSettings.aiLearningEnabled)
  });
  settings.system = compact({
    autoupdate: fromNullable(dbSettings.autoUpdateEnabled),
    updatetimes: compact({
      from: toClockTime(dbSettings.autoUpdateTimeFrom),
      to: toClockTime(dbSettings.autoUpdateTimeTo)
    })
  });
  return compact(settings) ?? {};
}

function fromSettings(settings: Settings): DbHomeSettings {
  const { allgemein, notifications, privacy, system } = settings;
  return new DbHomeSettings({
    id: HOME_SETTINGS_ID,
    homeName: toStringParam(allgemein?.name),
    language: toStringParam(allgemein?.sprache),
    temperatureUnit: toStringParam(allgemein?.temperatur),
    securityNotificationsEnabled: toBooleanParam(notifications?.security),
    batteryStatusNotificationsEnabled: toBooleanParam(notifications?.batterystatus),
    energyReportNotificationsEnabled: toBooleanParam(notifications?.energyreport),
    aiLearningEnabled: toBooleanParam(privacy?.ailearning),
    autoUpdateEnabled: toBooleanParam(system?.autoupdate),
    autoUpdateTimeFrom: toStringParam(system?.updatetimes?.from),
    autoUpdateTimeTo: toStringParam(system?.updatetimes?.to)
  });
}
