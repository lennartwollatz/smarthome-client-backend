import type { BmwTripCategory } from "./bmwCarTripCategory.js";
import type { BmwCarTripEntry } from "./bmwCarTripGrouper.js";

export function applyTripCategoriesToEntries(
  entries: BmwCarTripEntry[],
  categoriesByEntryId: Record<string, BmwTripCategory>
): BmwCarTripEntry[] {
  return entries.map(entry => {
    const tripCategory = resolveEntryCategory(entry, categoriesByEntryId);
    const segments = entry.segments.map(seg => ({
      ...seg,
      tripCategory:
        categoriesByEntryId[seg.id] ??
        (entry.grouped && categoriesByEntryId[entry.id] ? categoriesByEntryId[entry.id] : undefined)
    }));
    return { ...entry, tripCategory, segments };
  });
}

function resolveEntryCategory(
  entry: BmwCarTripEntry,
  categoriesByEntryId: Record<string, BmwTripCategory>
): BmwTripCategory | undefined {
  const direct = categoriesByEntryId[entry.id];
  if (direct) return direct;

  if (entry.grouped && entry.segments.length > 0) {
    const segmentCats = entry.segments
      .map(s => categoriesByEntryId[s.id])
      .filter((c): c is BmwTripCategory => c != null);
    if (segmentCats.length === entry.segments.length && segmentCats.every(c => c === segmentCats[0])) {
      return segmentCats[0];
    }
  }
  return undefined;
}
