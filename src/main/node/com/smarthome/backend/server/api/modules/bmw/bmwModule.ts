import { ModuleConfig, ModuleModel } from "../modules.js";

export const BMWCONFIG: ModuleConfig = {
  id: "bmw",
  managerId: "bmw-event-stream-manager",
  defaultDeviceName: "BMW Fahrzeug",
  deviceTypeName: "BMWDeviceDiscovered"
};

export const BMWMODULE: ModuleModel = {
  id: BMWCONFIG.id,
  name: "BMW",
  shortDescription: "Fahrzeugdaten per BMW CarData MQTT-Streaming (lesend)",
  longDescription:
    "Dieses Modul nutzt den offiziellen BMW CarData Datenstrom per MQTT (TLS), nicht mehr die frühere ConnectedDrive/MyBMW-Schnittstelle. " +
    "So erhältst du Statuswerte (z. B. Position, Reichweite, Türen), solange dein Fahrzeug im BMW CarData Portal für Streaming freigeschaltet ist. " +
    "Remote-Befehle (Klima, Ziel an Navigation senden) sind über CarData-Streaming nicht verfügbar. " +
    "Client-ID: In My BMW beim Fahrzeug BMW CarData öffnen, technischen Zugang anlegen und dort eine Client-ID erzeugen " +
    "(nicht mit „Authenticate Vehicle“ verwechseln). Anschließend CarData Streaming abonnieren und die gewünschten Telemetrie-Attribute auswählen. " +
    "Dokumentation: https://bmw-cardata.bmwgroup.com/customer/public/home " +
    "Anmeldung hier im Smarthome: Client-ID speichern, „Bei BMW anmelden“ (OAuth Device Code im Browser bestätigen). " +
    "Discovery sammelt VINs aus eingehenden MQTT-Nachrichten; das Fahrzeug muss dafür aktiv Daten senden.",
  categoryKey: "mobility",
  icon: "&#128663;",
  price: 0.0,
  version: "2.0.0"
};
