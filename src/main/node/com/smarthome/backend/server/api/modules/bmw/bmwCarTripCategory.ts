/** Zuordnung einer Fahrt (Einzelfahrt oder Gruppe) zu Privat oder Beruflich. */
export type BmwTripCategory = "private" | "business";

export function isBmwTripCategory(value: unknown): value is BmwTripCategory {
  return value === "private" || value === "business";
}
