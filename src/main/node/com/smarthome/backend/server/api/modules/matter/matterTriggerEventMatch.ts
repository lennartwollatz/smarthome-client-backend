import { EventType } from "../../../events/event-types/EventType.js";

/**
 * Baut Alias → kanonische EventType-Stringwerte.
 * Im Frontend/ Gerät stehen u. a. `TVScreenOn` oder `powerOn` — ausgelöste Events
 * nutzen {@link EventType} (`tvScreenOn`, `powerOn`).
 */
function buildTriggerAliasToCanonicalMap(): ReadonlyMap<string, string> {
  const m = new Map<string, string>();
  for (const v of Object.values(EventType) as string[]) {
    m.set(v, v);
    if (v.length > 0) {
      m.set(v.charAt(0).toUpperCase() + v.slice(1), v);
    }
    if (v.startsWith("tv")) {
      m.set("TV" + v.slice(2), v);
    }
  }
  return m;
}

const ALIAS = buildTriggerAliasToCanonicalMap();

/**
 * Liefert den EventType-Wert, auf den sich die in der UI gespeicherte Bezeichnung bezieht, oder `null`.
 */
export function resolveSavedTriggerNameToEventTypeId(saved: string | undefined | null): string | null {
  if (saved == null) return null;
  const t = String(saved).trim();
  if (!t) return null;
  return ALIAS.get(t) ?? (Object.values(EventType) as string[]).find(x => x === t) ?? null;
}

/**
 * @returns true, wenn `actualEventType` (vom `Event` nach Auslösung) zur gespeicherten Trigger-Zeichenkette passt
 */
export function matterSavedTriggerMatchesEvent(actualEventType: string, savedTrigger: string | undefined | null): boolean {
  if (savedTrigger == null || !String(savedTrigger).trim()) return false;
  const want = resolveSavedTriggerNameToEventTypeId(savedTrigger);
  return want != null && want === actualEventType;
}
