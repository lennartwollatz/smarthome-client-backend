import type { DeviceChangeField } from "./deviceChangeLog.js";

const IGNORED_KEYS = new Set([
  "id",
  "moduleId",
  "functionsBool",
  "functionsAction",
  "functionsTrigger",
  "functionDescriptions"
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenForAudit(value: unknown, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (value === null || value === undefined) {
    if (prefix) out[prefix] = value;
    return out;
  }

  if (Array.isArray(value)) {
    if (prefix.endsWith("energyUsages") || prefix.includes(".energyUsages")) {
      return out;
    }
    out[prefix || "[]"] = value;
    return out;
  }

  if (!isPlainObject(value)) {
    if (prefix) out[prefix] = value;
    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    if (!prefix && IGNORED_KEYS.has(key)) continue;
    if (key === "energyUsages") continue;

    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(child) || Array.isArray(child)) {
      Object.assign(out, flattenForAudit(child, path));
    } else {
      out[path] = child;
    }
  }

  return out;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function detectDeviceChanges(
  prev: Record<string, unknown> | undefined,
  next: Record<string, unknown>
): DeviceChangeField[] {
  if (!prev) return [];

  const flatPrev = flattenForAudit(prev);
  const flatNext = flattenForAudit(next);
  const keys = new Set([...Object.keys(flatPrev), ...Object.keys(flatNext)]);
  const changes: DeviceChangeField[] = [];

  for (const field of keys) {
    const oldValue = flatPrev[field];
    const newValue = flatNext[field];
    if (!valuesEqual(oldValue, newValue)) {
      changes.push({ field, oldValue: oldValue ?? null, newValue: newValue ?? null });
    }
  }

  return changes.sort((a, b) => a.field.localeCompare(b.field));
}
