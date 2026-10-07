import type { RowDataPacket } from "mysql2/promise";
import type { SqlExecutor, SqlParam } from "../../database.js";

/** Gerät als flaches Objekt (Ergebnis von toPlainObject bzw. Eingabe für convertDeviceFromDatabase). */
export type PlainDevice = Record<string, unknown> & {
  id: string;
  type?: string;
  moduleId?: string;
};

/** Tabellen einer Gerätefähigkeit (z. B. Licht) oder eines Moduls (z. B. Hue). */
export interface DeviceTableGroup {
  appliesTo(device: PlainDevice): boolean;
  /** Lädt die Zeilen aller Geräte mit je einer Abfrage pro Tabelle und ergänzt die Geräte. */
  load(db: SqlExecutor, devices: ReadonlyMap<string, PlainDevice>): Promise<void>;
  /** Schreibt die Zeilen eines Geräts; läuft innerhalb der Speicher-Transaktion. */
  save(tx: SqlExecutor, device: PlainDevice): Promise<void>;
}

export function toNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return String(value);
}

export function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function toNullableBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null) return null;
  return value === true || value === 1 || value === "1" || value === "true";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/** Baut Listenelemente ohne die Felder, für die nichts gespeichert war. */
export function withoutNulls(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null && value !== undefined));
}

/** Setzt ein Feld nur, wenn ein Wert gespeichert war; sonst greift der Default der Geräteklasse. */
export function assignIfSet(target: Record<string, unknown>, field: string, value: unknown): void {
  if (value !== null && value !== undefined) target[field] = value;
}

/** Gruppiert Kindzeilen nach Geräte-ID (Reihenfolge der Abfrage bleibt erhalten). */
export function groupByDevice<T extends RowDataPacket>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const deviceId = String(row.deviceId);
    const list = grouped.get(deviceId);
    if (list) list.push(row);
    else grouped.set(deviceId, [row]);
  }
  return grouped;
}

/** Ersetzt alle Kindzeilen eines Geräts: erst löschen, dann jede Zeile einzeln einfügen. */
export async function replaceRows(
  tx: SqlExecutor,
  deleteSql: string,
  insertSql: string,
  deviceId: string,
  rows: SqlParam[][]
): Promise<void> {
  await tx.execute(deleteSql, [deviceId]);
  for (const params of rows) {
    await tx.execute(insertSql, params);
  }
}
