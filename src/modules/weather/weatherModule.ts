import { ModuleConfig, ModuleModel } from "../modules.js";

export const WEATHERCONFIG: ModuleConfig = {
  id: "weather",
  managerId: "weather-event-stream-manager",
  defaultDeviceName: "Wetter",
  deviceTypeName: "WeatherDeviceDiscovered",
};

export const WEATHERMODULE: ModuleModel = {
  id: WEATHERCONFIG.id,
  name: "Wetter",
  shortDescription: "Standortbezogene Wetterinformationen",
  longDescription:
    "Ruft Wetterdaten über die Open-Meteo API ab. Liefert Außentemperatur, Wettertyp (Sonne, Regen, Nebel, Schnee, Bewölkt, Gewitter) sowie Forecast für die kommenden Tage.",
  categoryKey: "climate",
  icon: "&#9728;",
  price: 0.0,
  version: "1.0.0",
  features: ["Open-Meteo API", "Temperatur", "Wettertyp", "3-Tage-Forecast"],
};
