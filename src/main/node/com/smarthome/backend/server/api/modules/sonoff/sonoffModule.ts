import { ModuleConfig, ModuleModel } from "../modules.js";

export const SONOFFCONFIG: ModuleConfig = {
  id: "sonoff",
  managerId: "sonoff-event-stream-manager",
  defaultDeviceName: "Sonoff-Gerät",
  deviceTypeName: "SonoffDeviceDiscovered",
};

export const SONOFFMODULE: ModuleModel = {
  id: SONOFFCONFIG.id,
  name: "Sonoff",
  shortDescription: "Sonoff-Geräte mit Heimnetz-Steuerung verbinden",
  longDescription:
    "Mit diesem Modul verbindest du deine Sonoff-Geräte, die in der eWeLink-App schon eingerichtet sind und LAN-Steuerung unterstützen. Die Geräte müssen sich im gleichen Netzwerk befinden wie diese App. Zum Einrichten einmal kurz verbinden – anschließend kannst du sie hier schalten und steuern.",
  categoryKey: "lighting",
  icon: "&#9889;",
  price: 0.0,
  version: "1.0.0",
  /** CoolKit v2 Cloud (Login + /v2/device/thing). `ewelinkPassword` nur in der DB, nie im API-Default/Typ-Template. */
  moduleData: {
    ewelinkEmail: "",
    ewelinkCountryCode: "+49",
  },
};
