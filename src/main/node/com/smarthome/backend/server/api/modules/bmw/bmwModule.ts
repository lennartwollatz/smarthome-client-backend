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
  shortDescription: "BMW Fahrzeuge aus ConnectedDrive steuern",
  longDescription:
    "Verbinde deinen BMW ConnectedDrive Account, entdecke Fahrzeuge im Account und steuere Funktionen wie Klima sowie Zieladressen.",
  categoryKey: "mobility",
  icon: "&#128663;",
  price: 0.0,
  version: "1.0.0"
};

