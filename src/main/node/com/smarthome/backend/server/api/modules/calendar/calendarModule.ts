import type { ModuleConfig, ModuleModel } from "../modules.js";

/**
 * Zentrales Kalender-Repository (immer aktiv, keine Settings).
 * Andere Kalender-Provider (z.B. apple-calendar) synchronisieren/ändern Events über dieses Modul.
 */
export const CALENDARCONFIG: ModuleConfig = {
  id: "calendar",
  managerId: "calendar-core",
  defaultDeviceName: "Kalender",
  deviceTypeName: "CalendarDeviceDiscovered",
};

export const CALENDARMODULE: ModuleModel = {
  id: CALENDARCONFIG.id,
  name: "Kalender",
  shortDescription: "Zentrales Kalender-Repository",
  longDescription:
    "Dieses Modul speichert und aggregiert Termine aus mehreren Kalender-Modulen zentral und liefert aktuelle Termine ans Frontend. Es ist immer aktiv und hat keine eigenen Einstellungen.",
  categoryKey: "calendar",
  icon: "&#128197;",
  price: 0.0,
  version: "1.0.0"
};


