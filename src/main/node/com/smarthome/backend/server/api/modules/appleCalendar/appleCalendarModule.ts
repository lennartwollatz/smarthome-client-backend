import type { ModuleBridggedConfig, ModuleModel } from "../modules.js";

export const APPLECALENDARCONFIG: ModuleBridggedConfig = {
  // vom Nutzer gewünscht: calendar-apple
  id: "calendar-apple",
  managerId: "calendar-apple-event-stream-manager",
  defaultDeviceName: "Apple Kalender",
  deviceTypeName: "AppleCalendarDeviceDiscovered",
  bridgeTypeName: "AppleCalendarBridgeDiscovered"
};

export const APPLECALENDARMODULE: ModuleModel = {
  id: APPLECALENDARCONFIG.id,
  name: "Apple Kalender (CalDAV)",
  shortDescription: "Apple/iCloud Kalender via CalDAV",
  longDescription:
    "Bindet Apple/iCloud Kalender über CalDAV an. Kalender werden als Devices entdeckt und Termine werden über das npm Paket 'dav' synchronisiert.",
  categoryKey: "calendar",
  icon: "&#128197;",
  price: 0.0,
  version: "1.0.0"
};


