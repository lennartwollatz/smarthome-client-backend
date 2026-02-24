import { ModuleConfig, ModuleModel } from "../modules.js";

export const HEOSCONFIG: ModuleConfig = {  
    id: "heos",
    managerId: "heos-event-stream-manager",
    defaultDeviceName: "HEOS Device",
    deviceTypeName: "HEOSDeviceDiscovered"
}

// Heos ist abstrakt und wird nicht im Frontend angezeigt
// Nur konkrete Implementierungen wie Denon werden angezeigt
export const HEOSMODULE: ModuleModel = {
    id: "heos",
    name: "HEOS",
    shortDescription: "Abstrakte Basis für HEOS-kompatible Geräte",
    longDescription: "Abstrakte Basisklasse für HEOS-kompatible Geräte. Konkrete Implementierungen wie Denon werden im Frontend angezeigt.",
    categoryKey: "audioTv",
    icon: "&#127911;",
    price: 0.0,
    version: "1.0.0"
}

