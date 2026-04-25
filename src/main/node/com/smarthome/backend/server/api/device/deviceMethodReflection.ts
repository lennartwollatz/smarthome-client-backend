import { logger } from "../../../logger.js";
import type { Device } from "../../../model/devices/Device.js";

/**
 * Klammeranteil in Workflow-/API-Namen entfernen (z. B. `foo()` -> `foo`).
 */
export function stripParensBase(name: string): string {
  const i = name.indexOf("(");
  return i >= 0 ? name.slice(0, i) : name;
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

function convertValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
    if (!Number.isNaN(Number(value))) return Number(value);
  }
  return value;
}

/**
 * Wertet eine Geräte-Bool-Methode aus (0 oder 1+ Parameter wie `isAppSelected(x)`).
 */
export function evaluateDeviceBoolFunction(
  device: object,
  methodName: string,
  readArgs: unknown[] | undefined
): boolean | null {
  const resolved = getDeviceMethodExact(device, methodName);
  if (!resolved) {
    return null;
  }
  const fn = resolved.fn;
  const args = readArgs?.length
    ? readArgs.map(a => convertValue(a))
    : [];
  try {
    if (args.length === 0) {
      return Boolean(fn.call(device));
    }
    if (args.length === 1) {
      return Boolean(fn.call(device, args[0]));
    }
    return Boolean(fn.call(device, ...args));
  } catch (err) {
    logger.error({ err, methodName, deviceId: (device as Device).id }, "evaluateDeviceBoolFunction fehlgeschlagen");
    return null;
  }
}

/**
 * Dasselbe Parameter-Packing wie in {@link import("../entities/actions/action/Action.js") Action.invokeDeviceMethodInner}
 * (Roh-Argumentliste ohne `{ value, manual }` — vor Aufruf normalisieren).
 */
export function invokeDeviceActionMethodSync(device: Device, methodName: string, values: unknown[]): unknown {
  const resolved = getDeviceMethodExact(device, methodName);
  if (!resolved) {
    logger.warn(
      { methodName, deviceId: device.id },
      "invokeDeviceActionMethodSync: Methode nicht gefunden"
    );
    return;
  }
  const fn = resolved.fn;
  if (!values || values.length === 0) {
    if (fn.length >= 1) {
      return fn.call(device, true);
    }
    return fn.call(device);
  }
  if (values.length === 1) {
    const param = convertValue(values[0]);
    if (fn.length >= 2) {
      return fn.call(device, param, true);
    }
    return fn.call(device, param);
  }
  if (values.length === 2) {
    const param1 = convertValue(values[0]);
    const param2 = convertValue(values[1]);
    if (fn.length >= 3) {
      return fn.call(device, param1, param2, true);
    }
    return fn.call(device, param1, param2);
  }
  if (values.length > 2) {
    if (fn.length >= 4) {
      return fn.call(device, ...values, true);
    }
    return fn.call(device, ...values);
  }
  return;
}

export async function invokeDeviceActionMethodAsync(
  device: Device,
  methodName: string,
  values: unknown[]
): Promise<unknown> {
  const raw = invokeDeviceActionMethodSync(device, methodName, values);
  if (raw instanceof Promise) {
    return await raw;
  }
  return raw;
}

/** Wird von MatterDeviceBoolWriteSpec erwartet (ohne zirkuläre Imports nach matter/). */
export interface InferredBoolWritePair {
  writeOn: { method: string; values: unknown[] };
  writeOff: { method: string; values: unknown[] };
}

/**
 * Leitet Standard-Schreib-Methoden aus readFunction ab, wenn in der Config keine
 * writeOn/writeOff gesetzt sind. Unterstützt gängige isPowerOn/isScreenOn-Muster
 * (setPower/setScreen mit 3 Plätzen wie in Workflows) sowie einfache isX/setX-Paare.
 * Mit readArgs (z. B. isAppSelected) — kein Inferenz (zu gerätespezifisch).
 */
export function tryInferBoolWritePairForRead(
  device: object,
  readFunction: string,
  readArgs: unknown[] | undefined
): InferredBoolWritePair | null {
  if (readArgs?.length) {
    return null;
  }
  const r = readFunction?.trim() ?? "";
  if (!r) {
    return null;
  }

  if (r === "isPowerOn" || r === "isPowerOff") {
    if (getDeviceMethodExact(device, "setPower")) {
      return {
        writeOn: { method: "setPower", values: [true, true, true] },
        writeOff: { method: "setPower", values: [false, true, true] },
      };
    }
    if (getDeviceMethodExact(device, "setPowerOn") && getDeviceMethodExact(device, "setPowerOff")) {
      return {
        writeOn: { method: "setPowerOn", values: [true, true] },
        writeOff: { method: "setPowerOff", values: [true, true] },
      };
    }
  }
  if (r === "isScreenOn" || r === "isScreenOff") {
    if (getDeviceMethodExact(device, "setScreen")) {
      return {
        writeOn: { method: "setScreen", values: [true, true, true] },
        writeOff: { method: "setScreen", values: [false, true, true] },
      };
    }
  }

  // Einfach: isMute → setMute (1 Parameter) usw. (ein Camel-Segment nach "is", kein isPowerOn)
  const simple = /^is([A-Z][a-z0-9]+)$/.exec(r);
  if (simple) {
    const rest = simple[1];
    if (rest === "Power" || rest === "Screen" || rest.startsWith("Power") || rest.startsWith("Screen")) {
      return null;
    }
    const setter = `set${rest}`;
    const res = getDeviceMethodExact(device, setter);
    if (res) {
      const n = (res.fn as (this: object, ...a: unknown[]) => unknown).length;
      if (n >= 3) {
        return {
          writeOn: { method: setter, values: [true, true, true] },
          writeOff: { method: setter, values: [false, true, true] },
        };
      }
      if (n === 1) {
        return {
          writeOn: { method: setter, values: [true] },
          writeOff: { method: setter, values: [false] },
        };
      }
      if (n === 2) {
        return {
          writeOn: { method: setter, values: [true, true] },
          writeOff: { method: setter, values: [false, true] },
        };
      }
    }
  }
  return null;
}
