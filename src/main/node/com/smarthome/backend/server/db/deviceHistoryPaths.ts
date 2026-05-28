import path from "node:path";
import { createHash } from "node:crypto";

const MAX_FILENAME_LEN = 120;

/**
 * Erzeugt einen sicheren Dateinamen für deviceId (ohne Pfad-Traversal).
 * Sehr lange IDs werden gehasht, kurze bleiben lesbar.
 */
export function deviceHistoryFileBase(deviceId: string): string {
  const trimmed = (deviceId ?? "").trim();
  if (!trimmed) return "_invalid";
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "_");
  if (safe.length <= MAX_FILENAME_LEN) return safe;
  const hash = createHash("sha256").update(trimmed).digest("hex").slice(0, 16);
  return `${safe.slice(0, 48)}_${hash}`;
}

export function resolveDeviceHistoryDbPath(baseDir: string, deviceId: string): string {
  return path.join(baseDir, `${deviceHistoryFileBase(deviceId)}.sqlite`);
}
