import { ModuleModel, ModuleConfig } from "../modules.js";

export const SONOSCONFIG: ModuleConfig = {
    id: "sonos",
    managerId: "sonos-event-stream-manager",
    defaultDeviceName: "Sonos Speaker",
    deviceTypeName: "SonosDeviceDiscovered",
}

export const SONOSMODULE: ModuleModel = {
    id: SONOSCONFIG.id,
    name: "Sonos",
    shortDescription: "Verwaltung und Steuerung von Sonos Speakern",
    longDescription: "Integriere und steuere Sonos Multiroom-Lautsprechersysteme. Verwalte Wiedergabe, Lautstärke, Gruppen und Musikquellen über das Sonos-Netzwerk.",
    categoryKey: "audioTv",
    icon: "&#127911;",
    price: 0.0,
    version: "1.0.0"
}