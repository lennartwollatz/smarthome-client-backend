import { logger } from "../../../../logger.js";
import { ConnectedDrive, CarBrand, Regions } from 'bmw-connected-drive';
import { ModuleDeviceControllerEvent } from "../moduleDeviceControllerEvent.js";
import { BMWEvent } from "./bmwEvent.js";
import type { DeviceCarAddress, DeviceCarDoors, DeviceCarWindows } from "../../../../model/devices/DeviceCar.js";
import type { BMWCredentials } from "./bmwCredentialsStore.js";
import type { BMWCar } from "./devices/bmwCar.js";
import { BMWDeviceDiscovered } from "./bmwDeviceDiscovered.js";
import type { BMWTokenStore } from "./bmwTokenStore.js";
import { BMWConnectedDriveLogger } from "./bmwConnectedDriveLogger.js";

export class BMWDeviceController extends ModuleDeviceControllerEvent<BMWEvent, BMWCar> {
  private api?: ConnectedDrive;
  private connectedUsername?: string;
  private connectedPassword?: string;
  private connectedDriveLogger = new BMWConnectedDriveLogger();

  constructor(private tokenStore: BMWTokenStore) {
    super();
  }

  private ensureCredentials(credentials: BMWCredentials): boolean {
    // captchaToken ist nur beim allerersten Login notwendig.
    return Boolean(credentials.username && credentials.password);
  }

  private async connect(credentials: BMWCredentials): Promise<{
    api: ConnectedDrive;
    carBrand: CarBrand;
  } | null> {
    if (!this.ensureCredentials(credentials)) {
      return null;
    }
    const username = credentials.username;
    const password = credentials.password ?? "";
    const captchaToken = credentials.captchaToken?.trim() || undefined;

    if (
      this.api &&
      this.connectedUsername === username &&
      this.connectedPassword === password
    ) {
      return { api: this.api, carBrand: CarBrand.Bmw };
    }

    logger.info({ username }, "BMW DeviceController connect");

    this.api = new ConnectedDrive(
      username,
      password,
      Regions.RestOfWorld,
      this.tokenStore,
      this.connectedDriveLogger,
      captchaToken
    );

    logger.info({ api: this.api }, "BMW DeviceController connected");
    this.connectedUsername = username;
    this.connectedPassword = password;
    return { api: this.api, carBrand: CarBrand.Bmw };
  }

  async discoverVehicles(credentials: BMWCredentials): Promise<BMWDeviceDiscovered[]> {
    logger.info({ credentials }, "BMW DeviceController discoverVehicles");
    const apiContext = await this.connect(credentials);
    logger.info({ apiContext }, "BMW DeviceController discoverVehicles apiContext");
    if (!apiContext) return [];
    try {
      const vehicles = await apiContext.api.getVehicles();
      logger.info({ vehicles }, "BMW DeviceController discoverVehicles vehicles");
      const list = Array.isArray(vehicles) ? vehicles : [];
      return list
        .map(vehicle => this.toDiscoveredVehicle(vehicle))
        .filter((vehicle): vehicle is BMWDeviceDiscovered => vehicle !== null);
    } catch (err) {
      logger.error({ err }, "Fehler beim Abrufen der BMW Fahrzeuge");
      return [];
    }
  }

  async getVehicleStatus(credentials: BMWCredentials, vin: string): Promise<unknown | null> {
    const apiContext = await this.connect(credentials);
    if (!apiContext) return null;
    try {
      return await apiContext.api.getVehicleStatus(vin, apiContext.carBrand);
    } catch (err) {
      logger.error({ err, vin }, "Fehler beim Abrufen des BMW Fahrzeugstatus");
      return null;
    }
  }

  async startClimateControl(credentials: BMWCredentials, vin: string): Promise<boolean> {
    const apiContext = await this.connect(credentials);
    if (!apiContext) return false;
    try {
      await apiContext.api.startClimateControl(vin, apiContext.carBrand);
      return true;
    } catch (err) {
      logger.error({ err, vin }, "Fehler beim Starten der BMW Klimatisierung");
      return false;
    }
  }

  async stopClimateControl(credentials: BMWCredentials, vin: string): Promise<boolean> {
    const apiContext = await this.connect(credentials);
    if (!apiContext) return false;
    try {
      await apiContext.api.stopClimateControl(vin, apiContext.carBrand);
      return true;
    } catch (err) {
      logger.error({ err, vin }, "Fehler beim Stoppen der BMW Klimatisierung");
      return false;
    }
  }

  async sendAddress(credentials: BMWCredentials, vin: string, subject: string, address: DeviceCarAddress): Promise<boolean> {
    const apiContext = await this.connect(credentials);
    if (!apiContext) return false;
    try {
      await apiContext.api.sendMessage(
        vin,
        apiContext.carBrand,
        subject,
        JSON.stringify({
          places: [
            {
              lng: address.coordinates.longitude,
              lat: address.coordinates.latitude,
              name: address.name,
              title: subject,
              formattedAddress: address.name,
              position: {
                lng: address.coordinates.longitude,
                lat: address.coordinates.latitude
              }
            }
          ],
          vehicleInformation: { vin }
        })
      );
      return true;
    } catch (err) {
      logger.error({ err, vin }, "Fehler beim Senden der BMW Zieladresse");
      return false;
    }
  }

  toCarStatus(status: unknown): {
    fuelLevelPercent?: number;
    rangeKm?: number;
    mileageKm?: number;
    lockedState?: boolean;
    inUseState?: boolean;
    climateControlState?: boolean;
    location?: DeviceCarAddress;
    windows?: DeviceCarWindows;
    doors?: DeviceCarDoors;
  } {
    const value = (status ?? {}) as Record<string, any>;
    const location = value.location as Record<string, any> | undefined;
    const windowsState = value.windowsState as Record<string, any> | undefined;
    const doorsState = value.doorsState as Record<string, any> | undefined;

    const parsedLocation =
      location?.coordinates &&
      typeof location.coordinates.lat === "number" &&
      typeof location.coordinates.lng === "number"
        ? {
            coordinates: {
              latitude: location.coordinates.lat,
              longitude: location.coordinates.lng
            },
            name: String(location.address?.formatted ?? "")
          }
        : undefined;

    const parsedWindows = windowsState
      ? {
          leftFront: windowsState.leftFront === "CLOSED",
          leftRear: windowsState.leftRear === "CLOSED",
          rightFront: windowsState.rightFront === "CLOSED",
          rightRear: windowsState.rightRear === "CLOSED",
          combinedState: windowsState.combinedState === "CLOSED"
        }
      : undefined;

    const parsedDoors = doorsState
      ? {
          combinedSecurityState: doorsState.combinedSecurityState === "SECURED",
          leftFront: doorsState.leftFront === "CLOSED",
          leftRear: doorsState.leftRear === "CLOSED",
          rightFront: doorsState.rightFront === "CLOSED",
          rightRear: doorsState.rightRear === "CLOSED",
          combinedState: doorsState.combinedState === "CLOSED",
          hood: doorsState.hood === "CLOSED",
          trunk: doorsState.trunk === "CLOSED"
        }
      : undefined;

    const fuelPercent =
      typeof value.combustionFuelLevel?.remainingFuelPercent === "number"
        ? value.combustionFuelLevel.remainingFuelPercent
        : undefined;

    return {
      fuelLevelPercent: fuelPercent,
      rangeKm: typeof value.range === "number" ? value.range : undefined,
      mileageKm: typeof value.currentMilage === "number" ? value.currentMilage : undefined,
      lockedState: typeof value.securityOverviewMode === "string" ? value.securityOverviewMode === "ARMED" : undefined,
      inUseState: typeof value.pwf === "string" ? value.pwf !== "STANDING_CUSTOMER_NOT_IN_VEH" : undefined,
      climateControlState:
        typeof value.climateControlState === "string" ? value.climateControlState !== "OFF" : undefined,
      location: parsedLocation,
      windows: parsedWindows,
      doors: parsedDoors
    };
  }

  private toDiscoveredVehicle(vehicle: unknown): BMWDeviceDiscovered | null {
    const value = (vehicle ?? {}) as Record<string, any>;
    const vin = typeof value.vin === "string" ? value.vin : "";
    if (!vin) return null;
    const model = typeof value.model === "string" ? value.model : undefined;
    const brand = typeof value.brand === "string" ? value.brand : "BMW";
    const nameCandidates = [
      value.name,
      value.vehicleFinder?.description,
      value.model,
      `BMW ${vin.slice(-6)}`
    ].map(candidate => (typeof candidate === "string" ? candidate.trim() : ""));
    const name = nameCandidates.find(candidate => candidate.length > 0) ?? `BMW ${vin.slice(-6)}`;
    const id = `bmw-${vin.toLowerCase()}`;
    return new BMWDeviceDiscovered(id, name, vin, brand, model);
  }

  public async startEventStream(_device: BMWCar, _callback: (event: BMWEvent) => void): Promise<void> {
    // BMW nutzt im Modulmanager Polling fuer alle Fahrzeuge.
  }

  public async stopEventStream(_device: BMWCar): Promise<void> {
    // BMW nutzt im Modulmanager Polling fuer alle Fahrzeuge.
  }
}

