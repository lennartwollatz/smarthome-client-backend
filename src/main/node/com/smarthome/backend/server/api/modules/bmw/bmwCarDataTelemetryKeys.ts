/** Kanonische CarData-Streaming-Keys (exakte BMW-Telematik-Pfade). */

export type BmwTelemetryKeyMeta = {
  key: string;
  labelDe: string;
};

export const BMW_TRACKED_TELEMETRY_KEYS: readonly string[] = [
  "vehicle.chassis.axle.row2.wheel.right.tire.pressureTarget",
  "vehicle.chassis.axle.row1.wheel.right.tire.pressureTarget",
  "vehicle.chassis.axle.row2.wheel.left.tire.pressureTarget",
  "vehicle.chassis.axle.row1.wheel.left.tire.pressureTarget",
  "vehicle.chassis.axle.row2.wheel.left.tire.pressure",
  "vehicle.chassis.axle.row1.wheel.left.tire.pressure",
  "vehicle.chassis.axle.row2.wheel.right.tire.pressure",
  "vehicle.chassis.axle.row1.wheel.right.tire.pressure",
  "vehicle.vehicle.travelledDistance",
  "vehicle.drivetrain.lastRemainingRange",
  "vehicle.cabin.door.status",
  "vehicle.drivetrain.fuelSystem.level",
  "vehicle.cabin.window.row1.driver.status",
  "vehicle.cabin.door.row1.driver.isOpen",
  "vehicle.body.hood.isOpen",
  "vehicle.cabin.door.row2.driver.isOpen",
  "vehicle.vehicle.preConditioning.activity",
  "vehicle.cabin.door.row2.passenger.isOpen",
  "vehicle.cabin.door.row1.passenger.isOpen",
  "vehicle.cabin.window.row2.driver.status",
  "vehicle.cabin.window.row2.passenger.status",
  "vehicle.cabin.window.row1.passenger.status",
  "vehicle.cabin.infotainment.navigation.currentLocation.heading",
  "vehicle.vehicle.preConditioning.remainingTime",
  "vehicle.cabin.infotainment.navigation.currentLocation.longitude",
  "vehicle.cabin.infotainment.navigation.currentLocation.latitude",
  "vehicle.body.trunk.door"
] as const;

export const BMW_TRACKED_TELEMETRY_KEY_SET = new Set<string>(BMW_TRACKED_TELEMETRY_KEYS);

export const BMW_TELEMETRY_KEY_META: BmwTelemetryKeyMeta[] = [
  { key: "vehicle.chassis.axle.row2.wheel.right.tire.pressureTarget", labelDe: "Reifendruck hinten rechts (Soll)" },
  { key: "vehicle.chassis.axle.row1.wheel.right.tire.pressureTarget", labelDe: "Reifendruck vorne rechts (Soll)" },
  { key: "vehicle.chassis.axle.row2.wheel.left.tire.pressureTarget", labelDe: "Reifendruck hinten links (Soll)" },
  { key: "vehicle.chassis.axle.row1.wheel.left.tire.pressureTarget", labelDe: "Reifendruck vorne links (Soll)" },
  { key: "vehicle.chassis.axle.row2.wheel.left.tire.pressure", labelDe: "Reifendruck hinten links (Ist)" },
  { key: "vehicle.chassis.axle.row1.wheel.left.tire.pressure", labelDe: "Reifendruck vorne links (Ist)" },
  { key: "vehicle.chassis.axle.row2.wheel.right.tire.pressure", labelDe: "Reifendruck hinten rechts (Ist)" },
  { key: "vehicle.chassis.axle.row1.wheel.right.tire.pressure", labelDe: "Reifendruck vorne rechts (Ist)" },
  { key: "vehicle.vehicle.travelledDistance", labelDe: "Gesamtkilometerstand" },
  { key: "vehicle.drivetrain.lastRemainingRange", labelDe: "Restreichweite (km)" },
  { key: "vehicle.cabin.door.status", labelDe: "Verriegelung (Türstatus)" },
  { key: "vehicle.drivetrain.fuelSystem.level", labelDe: "Tankfüllstand (%)" },
  { key: "vehicle.cabin.window.row1.driver.status", labelDe: "Fenster links vorne" },
  { key: "vehicle.cabin.door.row1.driver.isOpen", labelDe: "Tür links vorne" },
  { key: "vehicle.body.hood.isOpen", labelDe: "Motorhaube" },
  { key: "vehicle.cabin.door.row2.driver.isOpen", labelDe: "Tür hinten links" },
  { key: "vehicle.vehicle.preConditioning.activity", labelDe: "Klimatisierung" },
  { key: "vehicle.cabin.door.row2.passenger.isOpen", labelDe: "Tür rechts hinten" },
  { key: "vehicle.cabin.door.row1.passenger.isOpen", labelDe: "Tür rechts vorne" },
  { key: "vehicle.cabin.window.row2.driver.status", labelDe: "Fenster links hinten" },
  { key: "vehicle.cabin.window.row2.passenger.status", labelDe: "Fenster rechts hinten" },
  { key: "vehicle.cabin.window.row1.passenger.status", labelDe: "Fenster rechts vorne" },
  { key: "vehicle.cabin.infotainment.navigation.currentLocation.heading", labelDe: "Ausrichtung (°)" },
  { key: "vehicle.vehicle.preConditioning.remainingTime", labelDe: "Klima Restzeit" },
  { key: "vehicle.cabin.infotainment.navigation.currentLocation.longitude", labelDe: "Longitude" },
  { key: "vehicle.cabin.infotainment.navigation.currentLocation.latitude", labelDe: "Latitude" },
  { key: "vehicle.body.trunk.door", labelDe: "Kofferraum" }
];

export function isTrackedTelemetryKey(key: string): boolean {
  return BMW_TRACKED_TELEMETRY_KEY_SET.has(key);
}

export function pickTrackedTelemetry(snapshot: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of BMW_TRACKED_TELEMETRY_KEYS) {
    if (key in snapshot) {
      out[key] = snapshot[key];
    }
  }
  return out;
}
