import { ModuleConfig, ModuleModel } from "../modules.js";

export const MATTERCONFIG: ModuleConfig = {
    id: "matter",
    managerId: "matter-event-stream-manager",
    defaultDeviceName: "Matter Device"
}


export const MATTERMODULE: ModuleModel = {
    id: MATTERCONFIG.id,
    name: "Matter",
    shortDescription: "Matter-kompatible Geräte verbinden und steuern",
    longDescription: "Verbinde und steuere Geräte über den Matter-Standard. Matter ist ein einheitliches Protokoll für Smart-Home-Geräte verschiedener Hersteller.",
    categoryKey: "services",
    icon: "&#128268;",
    price: 0.0,
    version: "1.0.0"
}

