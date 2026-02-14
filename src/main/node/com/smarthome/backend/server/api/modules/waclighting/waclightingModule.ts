import { ModuleConfig, ModuleModel } from "../modules.js";

export const WACLIGHTINGCONFIG: ModuleConfig = {  
    id: "waclighting",
    managerId: "waclighting-event-stream-manager",
    defaultDeviceName: "WAC Device"
}

// Heos ist abstrakt und wird nicht im Frontend angezeigt
// Nur konkrete Implementierungen wie Denon werden angezeigt
export const WACLIGHTINGMODULE: ModuleModel = {
    id: "waclighting",
    name: "WAC LIGHTING",
    shortDescription: "Modul, mit dem geräte der Firma WAC LIGHTING gesteuert werden können.",
    longDescription: "TODO",
    categoryKey: "household",
    icon: "&#127744;",
    price: 0.0,
    version: "1.0.0"
}