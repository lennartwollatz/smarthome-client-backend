/** Minuten seit Mitternacht (0–1439) oder null bei ungueltiger Eingabe. */
export function parseTimeToMinutes(value: string | undefined | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Aktuelle lokale Uhrzeit des Servers als Minuten seit Mitternacht. */
export function getCurrentLocalMinutes(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Millisekunden bis zur naechsten lokalen Vorkommen der Uhrzeit (HH:mm).
 * Liegt die Zeit heute bereits vor, wird der naechste Tag verwendet.
 */
export function millisecondsUntilLocalTime(
  targetHHmm: string | undefined | null,
  now: Date = new Date()
): number | null {
  const target = parseTimeToMinutes(targetHHmm);
  if (target === null) return null;
  const current = getCurrentLocalMinutes(now);
  let diffMinutes = target - current;
  if (diffMinutes <= 0) {
    diffMinutes += 24 * 60;
  }
  return diffMinutes * 60 * 1000;
}

export type TimeConditionOperator = "after" | "before" | "equals" | "notEquals";

/**
 * Vergleicht die aktuelle lokale Uhrzeit mit einem Zielwert (HH:mm).
 * - after: jetzt ist spaeter als die Zielzeit (strikt >)
 * - before: jetzt ist frueher als die Zielzeit (strikt <)
 * - equals / notEquals: gleiche Minute
 */
export function evaluateTimeCondition(
  operator: string | undefined,
  compareLiteral: string | undefined,
  now: Date = new Date()
): boolean {
  const target = parseTimeToMinutes(compareLiteral);
  if (target === null) return false;
  const current = getCurrentLocalMinutes(now);
  const op = String(operator ?? "after").trim() as TimeConditionOperator;
  switch (op) {
    case "before":
      return current < target;
    case "equals":
      return current === target;
    case "notEquals":
      return current !== target;
    case "after":
    default:
      return current > target;
  }
}
