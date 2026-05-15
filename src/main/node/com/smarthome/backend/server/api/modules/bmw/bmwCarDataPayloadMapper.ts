import type { DeviceCarAddress, DeviceCarDoors, DeviceCarWindows } from "../../../../model/devices/DeviceCar.js";
import { logger } from "../../../../logger.js";
import { BMW_TRACKED_TELEMETRY_KEYS, pickTrackedTelemetry } from "./bmwCarDataTelemetryKeys.js";

export { pickTrackedTelemetry, BMW_TRACKED_TELEMETRY_KEYS };

const MAX_UNMAPPED_DEBUG_LOGS = 3;
let unmappedDebugLogsShown = 0;

export type TirePressureQuad = {
  frontLeft?: number;
  frontRight?: number;
  rearLeft?: number;
  rearRight?: number;
};

/**
 * Mappt gesammelte CarData-Streaming-Keys (flache Werte) auf DeviceCar-/BMWCar-Felder.
 */
export function mapTelemetrySnapshotToCarFields(snapshot: Record<string, unknown>): {
  fuelLevelPercent?: number;
  rangeKm?: number;
  mileageKm?: number;
  lockedState?: boolean;
  inUseState?: boolean;
  climateControlState?: boolean;
  location?: DeviceCarAddress;
  windows?: DeviceCarWindows;
  doors?: DeviceCarDoors;
  batterySocPercent?: number;
  batterySizeMaxKwh?: number;
  tirePressuresKpa?: TirePressureQuad;
  tirePressureTargetKpa?: TirePressureQuad;
  headingDegrees?: number;
  climateRemainingTime?: number;
  carDataTelemetry?: Record<string, unknown>;
} {
  const getNum = (key: string): number | undefined => {
    const v = snapshot[key];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };

  const getBool = (key: string): boolean | undefined => {
    const v = snapshot[key];
    if (typeof v === "boolean") return v;
    return undefined;
  };

  const getString = (key: string): string | undefined => {
    const v = snapshot[key];
    return typeof v === "string" ? v : undefined;
  };

  const windowClosedFromStatus = (key: string): boolean | undefined => {
    const s = getString(key)?.toUpperCase();
    if (s === "CLOSED") return true;
    if (s === "OPEN") return false;
    return undefined;
  };

  const lat = getNum("vehicle.cabin.infotainment.navigation.currentLocation.latitude");
  const lng = getNum("vehicle.cabin.infotainment.navigation.currentLocation.longitude");
  const addrName =
    (snapshot["vehicle.cabin.infotainment.navigation.currentLocation.address"] as string | undefined) ?? "";

  const location: DeviceCarAddress | undefined =
    lat != null && lng != null
      ? {
          coordinates: { latitude: lat, longitude: lng },
          name: typeof addrName === "string" ? addrName : ""
        }
      : undefined;

  const fuelPct =
    getNum("vehicle.drivetrain.fuelSystem.level") ??
    getNum("vehicle.drivetrain.fuelSystem.remainingFuelPercent") ??
    getNum("vehicle.drivetrain.combustionFuelLevel.remainingFuelPercent");

  const soc = getNum("vehicle.drivetrain.batteryManagement.header");
  const batterySizeMaxKwh = getNum("vehicle.drivetrain.batteryManagement.batterySizeMax");

  const rangeKm =
    getNum("vehicle.drivetrain.lastRemainingRange") ??
    getNum("vehicle.drivetrain.electricEngine.kombiRemainingElectricRange") ??
    getNum("vehicle.drivetrain.combustionEngine.remainingRange");

  const mileageKm =
    getNum("vehicle.vehicle.travelledDistance") ??
    getNum("vehicle.chassis.odometer") ??
    getNum("vehicle.drivetrain.internalCombustionEngine.odometer") ??
    getNum("vehicle.currentOverallVehicleMileage");

  const doorStatus = getString("vehicle.cabin.door.status")?.toUpperCase();
  const lockedFromStatus =
    doorStatus === "SECURED" ? true : doorStatus != null && doorStatus !== "SECURED" ? false : undefined;

  const leftFrontDoor =
    getBool("vehicle.cabin.door.row1.driver.isOpen") ??
    getBool("vehicle.cabin.door.row1.driverSide.isOpen");
  const rightFrontDoor =
    getBool("vehicle.cabin.door.row1.passenger.isOpen") ??
    getBool("vehicle.cabin.door.row1.passengerSide.isOpen");
  const leftRearDoor =
    getBool("vehicle.cabin.door.row2.driver.isOpen") ??
    getBool("vehicle.cabin.door.row2.driverSide.isOpen");
  const rightRearDoor =
    getBool("vehicle.cabin.door.row2.passenger.isOpen") ??
    getBool("vehicle.cabin.door.row2.passengerSide.isOpen");
  const hood = getBool("vehicle.body.hood.isOpen");
  const trunk =
    getBool("vehicle.body.trunk.door") ?? getBool("vehicle.body.trunk.isOpen");

  const leftFrontWin =
    windowClosedFromStatus("vehicle.cabin.window.row1.driver.status") ??
    getBool("vehicle.cabin.window.row1.driverSide.isClosed");
  const rightFrontWin =
    windowClosedFromStatus("vehicle.cabin.window.row1.passenger.status") ??
    getBool("vehicle.cabin.window.row1.passengerSide.isClosed");
  const leftRearWin =
    windowClosedFromStatus("vehicle.cabin.window.row2.driver.status") ??
    getBool("vehicle.cabin.window.row2.driverSide.isClosed");
  const rightRearWin =
    windowClosedFromStatus("vehicle.cabin.window.row2.passenger.status") ??
    getBool("vehicle.cabin.window.row2.passengerSide.isClosed");

  let doors: DeviceCarDoors | undefined;
  if (
    leftFrontDoor != null ||
    rightFrontDoor != null ||
    leftRearDoor != null ||
    rightRearDoor != null ||
    hood != null ||
    trunk != null
  ) {
    const doorVals = [leftFrontDoor, leftRearDoor, rightFrontDoor, rightRearDoor, hood, trunk].filter(
      (x): x is boolean => typeof x === "boolean"
    );
    const combinedState = doorVals.length > 0 ? doorVals.every(d => !d) : undefined;
    doors = {
      combinedSecurityState: combinedState === true,
      leftFront: leftFrontDoor === false,
      leftRear: leftRearDoor === false,
      rightFront: rightFrontDoor === false,
      rightRear: rightRearDoor === false,
      combinedState: combinedState === true,
      hood: hood === false,
      trunk: trunk === false
    };
  }

  let windows: DeviceCarWindows | undefined;
  if (leftFrontWin != null || rightFrontWin != null || leftRearWin != null || rightRearWin != null) {
    const wins = [leftFrontWin, leftRearWin, rightFrontWin, rightRearWin].filter(
      (x): x is boolean => typeof x === "boolean"
    );
    const combined = wins.length > 0 ? wins.every(Boolean) : undefined;
    windows = {
      leftFront: leftFrontWin === true,
      leftRear: leftRearWin === true,
      rightFront: rightFrontWin === true,
      rightRear: rightRearWin === true,
      combinedState: combined === true
    };
  }

  const preCondActivity = getString("vehicle.vehicle.preConditioning.activity")?.toUpperCase();
  const climateFromActivity =
    preCondActivity === "ACTIVE" ? true : preCondActivity === "INACTIVE" ? false : undefined;

  const climate =
    climateFromActivity ??
    getBool("vehicle.cabin.hvac.preconditioning.isActive") ??
    getBool("vehicle.cabin.hvac.climateControl.isOn");

  const locked =
    lockedFromStatus ??
    getBool("vehicle.body.watchedOverallVehicle.isSecured") ??
    getBool("vehicle.body.centralLocking.isLocked");

  const inUseCandidate =
    getBool("vehicle.status.car.inUse") ??
    getBool("vehicle.status.car.inUseState") ??
    climate;

  const tirePressuresKpa: TirePressureQuad = {
    frontLeft:
      getNum("vehicle.chassis.axle.row1.wheel.left.tire.pressure") ??
      getNum("vehicle.chassis.axle.row1.wheel.left.tire.pressure"),
    frontRight:
      getNum("vehicle.chassis.axle.row1.wheel.right.tire.pressure") ??
      getNum("vehicle.chassis.axle.row1.wheel.right.tire.pressure"),
    rearLeft:
      getNum("vehicle.chassis.axle.row2.wheel.left.tire.pressure") ??
      getNum("vehicle.chassis.axle.row2.wheel.left.tire.pressure"),
    rearRight:
      getNum("vehicle.chassis.axle.row2.wheel.right.tire.pressure") ??
      getNum("vehicle.chassis.axle.row2.wheel.right.tire.pressure")
  };

  const tirePressureTargetKpa: TirePressureQuad = {
    frontLeft: getNum("vehicle.chassis.axle.row1.wheel.left.tire.pressureTarget"),
    frontRight: getNum("vehicle.chassis.axle.row1.wheel.right.tire.pressureTarget"),
    rearLeft: getNum("vehicle.chassis.axle.row2.wheel.left.tire.pressureTarget"),
    rearRight: getNum("vehicle.chassis.axle.row2.wheel.right.tire.pressureTarget")
  };

  const headingDegrees = getNum("vehicle.cabin.infotainment.navigation.currentLocation.heading");
  const climateRemainingTime = getNum("vehicle.vehicle.preConditioning.remainingTime");

  const carDataTelemetry = pickTrackedTelemetry(snapshot);

  if (
    process.env.BMW_CAR_DATA_DEBUG_UNMAPPED_KEYS === "1" &&
    unmappedDebugLogsShown < MAX_UNMAPPED_DEBUG_LOGS
  ) {
    const mappedKeys = new Set<string>([...BMW_TRACKED_TELEMETRY_KEYS]);
    const unmapped = Object.keys(snapshot).filter(k => !mappedKeys.has(k)).slice(0, 25);
    if (unmapped.length > 0) {
      unmappedDebugLogsShown += 1;
      logger.debug?.({ sampleKeys: unmapped }, "BMW CarData: Unmapped Keys Sample");
    }
  }

  return {
    fuelLevelPercent: fuelPct ?? soc,
    rangeKm,
    mileageKm,
    lockedState: locked,
    inUseState: inUseCandidate,
    climateControlState: climate,
    location,
    windows,
    doors,
    batterySocPercent: soc,
    batterySizeMaxKwh,
    tirePressuresKpa,
    tirePressureTargetKpa,
    headingDegrees,
    climateRemainingTime,
    carDataTelemetry
  };
}
