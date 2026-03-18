import { ModuleConfig, ModuleModel } from "../modules.js";

export const XIAOMICONFIG: ModuleConfig = {
    id: "xiaomi",
    managerId: "xiaomi-event-stream-manager",
    defaultDeviceName: "Xiaomi Vacuum Cleaner",
    deviceTypeName: "XiaomiDeviceDiscovered",
}

export const XIAOMIMODULE: ModuleModel = {
    id: XIAOMICONFIG.id,
    name: "Xiaomi",
    shortDescription: "Verwaltung und Steuerung von Xiaomi Geräten",
    longDescription: "Integriere und steuere Xiaomi Smart Home Geräte wie Staubsaugerroboter über das MiIO-Protokoll. Verwalte Geräte, Status und Aktionen.",
    categoryKey: "household",
    icon: "&#129529;",
    price: 0.0,
    version: "1.0.0"
}

