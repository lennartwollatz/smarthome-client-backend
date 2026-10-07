import { ModuleBridggedConfig, ModuleModel } from "../modules.js";

export const HUECONFIG: ModuleBridggedConfig = {
    id: "hue",
    managerId: "hue-event-stream-manager",
    defaultDeviceName: "Hue Device",
    deviceTypeName: "HueDeviceDiscovered",
    bridgeTypeName: "HueBridgeDiscovered"
}
    	
export const HUEMODULE: ModuleModel = {
    id: HUECONFIG.id,
    name: "Hue",
    shortDescription: "Hue Geräte verbinden und steuern",
    longDescription: "Verbinde und steuere Philips Hue Leuchten, Sensoren und Schalter. Verwalte Farben, Helligkeit, Temperatur und erweiterte Hue-Funktionen über die Hue Bridge.",
    categoryKey: "lighting",
    icon: "&#128161;",
    price: 0.0,
    version: "1.0.0"
}

