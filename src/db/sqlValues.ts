import type { SqlParam } from "./database.js";

/** MySQL liefert BOOLEAN als TINYINT(1), also 0 oder 1. */
export function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

export function toStringParam(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

export function toNumberParam(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function toDateParam(value: unknown): Date {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function toJsonParam(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export function fromJsonColumn<T>(value: unknown): T {
  if (value === null || value === undefined) return {} as T;
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

export function fromNullable<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

/** Wandelt ein Modell über seine JSON-Repräsentation (inkl. toJSON) in ein flaches Objekt um. */
export function toPlainObject(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
}

/** Entfernt die als eigene Spalten gespeicherten Felder; der Rest landet in der JSON-Spalte `attributes`. */
export function withoutKeys(
  plain: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(plain)) {
    if (!keys.includes(key)) rest[key] = value;
  }
  return rest;
}

/** Erzeugt `?, ?, ?` für IN-Listen. */
export function placeholders(values: readonly SqlParam[]): string {
  return values.map(() => "?").join(", ");
}
