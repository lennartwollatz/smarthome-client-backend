import { ModuleConfig, ModuleModel } from "../../modules.js";

export const DENONCONFIG: ModuleConfig = {
    id: "denon",
    managerId: "denon-event-stream-manager",
    defaultDeviceName: "Denon HEOS Device",
    deviceTypeName: "DenonDeviceDiscovered"
}

export const DENONMODULE: ModuleModel = {
    id: "denon",
    name: "Denon HEOS",
    shortDescription: "Steuerung von Denon/HEOS Speakern",
    longDescription: "Integriere und steuere Denon HEOS Multiroom-Lautsprechersysteme. Verwalte Lautstärke, Wiedergabestatus und Zonen über das HEOS-Protokoll.",
    categoryKey: "audioTv",
    icon: "&#127911;",
    price: 0.0,
    version: "1.0.0"
}

