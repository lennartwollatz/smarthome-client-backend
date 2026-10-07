import { ModuleConfig, ModuleModel } from "../modules.js";

export const LGCONFIG: ModuleConfig = {
    id: "lg",
    managerId: "lg-event-stream-manager",
    defaultDeviceName: "LG TV",
    deviceTypeName: "LGDeviceDiscovered",
}

export const LGMODULE: ModuleModel = {
    id: LGCONFIG.id,
    name: "LG TV",
    shortDescription: "Verwaltung und Steuerung von LG Fernsehern",
    longDescription: "Steuere LG Smart TVs über das Netzwerk. Verwalte Ein-/Ausschalten, Lautstärke, Kanäle und erweiterte TV-Funktionen.",
    categoryKey: "audioTv",
    icon: "&#128250;",
    price: 0.0,
    version: "1.0.0"
}

