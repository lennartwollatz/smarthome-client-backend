/**
 * DeviceType Enum - Alle unterstützten Gerätetypen.
 * Kompatibel mit Frontend-Datenmodell.
 */
export enum DeviceType {
  // Licht-Geräte
  LIGHT = "light",
  LIGHT_DIMMER = "light-dimmer",
  LIGHT_DIMMER_TEMPERATURE = "light-dimmer-temperature",
  LIGHT_DIMMER_TEMPERATURE_COLOR = "light-dimmer-temperature-color",
  
  // Schalter-Geräte
  SWITCH = "switch",
  SWITCH_DIMMER = "switch-dimmer",
  SWITCH_ENERGY = "switch-energy",
  OUTLET = "outlet",
  
  // Sensoren
  MOTION = "motion",
  LIGHT_LEVEL = "light-level",
  TEMPERATURE = "temperature",
  MOTION_LIGHT_LEVEL = "motion-light-level",
  MOTION_LIGHT_LEVEL_TEMPERATURE = "motion-light-level-temperature",
  SENSOR = "sensor",
  
  // Klima & Komfort
  THERMOSTAT = "thermostat",
  BLINDS = "blinds",
  
  // Sicherheit
  LOCK = "lock",
  CAMERA = "camera",
  DOORBELL = "doorbell",
  
  // Unterhaltung
  SPEAKER = "speaker",
  SPEAKER_RECEIVER = "speaker-receiver",
  TV = "tv",
  
  // Haushaltsgeräte
  VACUUM = "vacuum",
  IRRIGATION = "irrigation",
  GARAGE = "garage",
  
  // Fahrzeuge
  CAR = "car"
}

export function deviceTypeFromString(value?: string | null) {
  if (!value) return null;
  const entries = Object.values(DeviceType) as string[];
  return entries.includes(value) ? (value as DeviceType) : null;
}

