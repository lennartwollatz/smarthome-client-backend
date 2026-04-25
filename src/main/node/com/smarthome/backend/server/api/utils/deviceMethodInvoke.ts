import { logger } from "../../../logger.js";
import { Device } from "../../../model/devices/Device.js";

/**
 * Optionaler Klammerteil `foo()` abschneiden.
 */
export function stripParensBase(name: string): string {
  const i = name.indexOf("(");
  return i >= 0 ? name.slice(0, i) : name;
}

/**
 * Frontend liefert Parameter als `{ value, manual }`; für Geräteaufrufe Rohwerte.
 */
function normalizeWorkflowArgValue(entry: unknown): unknown {
  if (entry === null || typeof entry !== "object") return entry;
  const o = entry as Record<string, unknown>;
  if ("manual" in o && "value" in o) return o.value;
  if ("value" in o && "name" in o && "id" in o) return o.value;
  return entry;
}

export function normalizeWorkflowArgList(values: unknown[] | undefined): unknown[] {
  if (!values?.length) return [];
  return values.map(normalizeWorkflowArgValue);
}

export function getDeviceMethodExact(
  device: object,
  methodNameWithOptionalParens: string
): { methodName: string; fn: (...args: unknown[]) => unknown } | null {
  const methodName = stripParensBase(methodNameWithOptionalParens);
  if (!methodName) return null;
  const fn = (device as Record<string, unknown>)[methodName];
  if (typeof fn !== "function") return null;
  return { methodName, fn: fn as (...args: unknown[]) => unknown };
}

function convertValue(value: unknown) {
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
    if (!Number.isNaN(Number(value))) return Number(value);
  }
  return value;
}

/**
 * Dasselbe Verhalten wie {@link import("../entities/actions/action/Action.js").Action#invokeDeviceMethodInner}:
 * exakter Methodenname, Workflow-Arg-Normalisierung, execute-Flag bei Bedarf.
 */
export function invokeDeviceMethodOnDevice(device: Device, methodName: string, values: unknown[]): unknown {
  try {
    values = normalizeWorkflowArgList(values);
    const resolved = getDeviceMethodExact(device, methodName);
    if (!resolved) {
      logger.warn({ methodName, deviceId: device.id }, "deviceMethodInvoke: Methode nicht gefunden");
      return;
    }
    const fn = resolved.fn;
    if (!values || values.length === 0) {
      if (fn.length >= 1) {
        return fn.call(device, true);
      } else {
        return fn.call(device);
      }
    }
    if (values.length === 1) {
      const param = convertValue(values[0]);
      if (fn.length >= 2) {
        return fn.call(device, param, true);
      } else {
        return fn.call(device, param);
      }
    }
    if (values.length === 2) {
      const param1 = convertValue(values[0]);
      const param2 = convertValue(values[1]);
      if (fn.length >= 3) {
        return fn.call(device, param1, param2, true);
      } else {
        return fn.call(device, param1, param2);
      }
    }
    if (values.length > 2) {
      if (fn.length >= 4) {
        return fn.call(device, ...values, true);
      } else {
        return fn.call(device, ...values);
      }
    }
  } catch (err) {
    logger.error({ err, methodName, deviceId: device.id }, "Fehler bei invokeDeviceMethodOnDevice");
  }
}
