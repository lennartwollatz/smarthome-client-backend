import type { DatabaseManager } from "../../../db/database.js";
import { logger } from "../../../../logger.js";
import { ModuleManager } from "../moduleManager.js";
import { BMWDeviceController } from "./bmwDeviceController.js";
import { BMWDeviceDiscovered } from "./bmwDeviceDiscovered.js";
import { BMWDeviceDiscover } from "./bmwDeviceDiscover.js";
import { BMWEvent } from "./bmwEvent.js";
import { BMWEventStreamManager } from "./bmwEventStreamManager.js";
import { EventManager } from "../../../events/EventManager.js";
import { BMWCONFIG } from "./bmwModule.js";
import { BMWCar } from "./devices/bmwCar.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { Device } from "../../../../model/devices/Device.js";
import { BMWCredentialsStore } from "./bmwCredentialsStore.js";
import { BMWTokenStore } from "./bmwTokenStore.js";
import { BMWVehicleNamesStore, normalizeBmwVin } from "./bmwVehicleNamesStore.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { BMW_TRACKED_TELEMETRY_KEYS, BMW_TELEMETRY_KEY_META } from "./bmwCarDataTelemetryKeys.js";

export class BMWModuleManager extends ModuleManager<
  BMWEventStreamManager,
  BMWDeviceController,
  BMWDeviceController,
  BMWEvent,
  BMWCar,
  BMWDeviceDiscover,
  BMWDeviceDiscovered
> {
  private credentialsStore: BMWCredentialsStore;
  private tokenStore: BMWTokenStore;
  private vehicleNamesStore: BMWVehicleNamesStore;
  private readonly registeredVins = new Set<string>();

  constructor(databaseManager: DatabaseManager, deviceManager: DeviceManager, eventManager: EventManager) {
    const tokenStore = new BMWTokenStore(databaseManager);
    const credentialsStore = new BMWCredentialsStore(databaseManager);
    const vehicleNamesStore = new BMWVehicleNamesStore(databaseManager);
    const telemetryHistory = deviceManager.getBmwTelemetryHistoryStore();
    const deviceController = new BMWDeviceController(tokenStore, credentialsStore, telemetryHistory);
    const deviceDiscover = new BMWDeviceDiscover(databaseManager, deviceController);

    super(databaseManager, deviceManager, eventManager, deviceController, deviceDiscover);
    this.credentialsStore = credentialsStore;
    this.tokenStore = tokenStore;
    this.vehicleNamesStore = vehicleNamesStore;

    deviceController.setVinDeviceResolver(vin => {
      const ids: string[] = [];
      for (const d of deviceManager.getDevicesForModule(BMWCONFIG.id)) {
        if (d instanceof BMWCar && d.vin === vin && d.id) {
          ids.push(d.id);
        }
      }
      return ids;
    });

    deviceController.setOnVinObserved(vin => this.registerCarFromVin(vin));
  }

  private registerCarFromVin(vin: string): void {
    if (!vin || this.registeredVins.has(vin)) return;
    this.registeredVins.add(vin);
    void this.ensureCarDeviceForVin(vin);
  }

  private deviceIdForVin(vin: string): string {
    return `bmw-${normalizeBmwVin(vin).toLowerCase()}`;
  }

  defaultNameForVin(vin: string): string {
    const v = normalizeBmwVin(vin);
    return v ? `BMW ${v.slice(-6)}` : BMWCONFIG.defaultDeviceName;
  }

  resolveVehicleDisplayName(vin: string): string {
    return this.vehicleNamesStore.getName(vin) ?? this.defaultNameForVin(vin);
  }

  getVehicleNames(): Record<string, string> {
    return this.vehicleNamesStore.getAll();
  }

  async setVehicleName(vin: string, name: string): Promise<BMWCar | null> {
    const normalized = normalizeBmwVin(vin);
    if (!normalized) {
      return null;
    }
    this.vehicleNamesStore.setName(normalized, name);
    const displayName = this.resolveVehicleDisplayName(normalized);
    const car = await this.findCarByVin(normalized, false);
    if (!car) {
      return null;
    }
    car.name = displayName;
    car.setBMWController(this.deviceController);
    this.saveBmwCarPreservingFields(car);
    return car;
  }

  private async findCarByVin(normalizedVin: string, refreshTelemetry = false): Promise<BMWCar | null> {
    const byId = await this.getCar(this.deviceIdForVin(normalizedVin), { refreshTelemetry });
    if (byId) {
      return byId;
    }
    for (const d of this.deviceManager.getDevicesForModule(this.getModuleId())) {
      const deviceVin = (d as Device & { vin?: string }).vin;
      if (deviceVin && normalizeBmwVin(deviceVin) === normalizedVin && d.id) {
        return await this.getCar(d.id, { refreshTelemetry });
      }
    }
    return null;
  }

  /** Beim Speichern Felder erhalten, die beim JSON-Export sonst verloren gehen (z. B. quickAccess). */
  private saveBmwCarPreservingFields(car: BMWCar): void {
    const prev = this.deviceManager.getDevice(car.id);
    if (prev) {
      if (typeof prev.isConnected === "boolean") {
        car.isConnected = prev.isConnected;
      }
      if (typeof prev.quickAccess === "boolean") {
        car.quickAccess = prev.quickAccess;
      }
      if (!car.room && prev.room) {
        car.room = prev.room;
      }
      const prevVin = (prev as Device & { vin?: string }).vin;
      if (!car.vin && prevVin) {
        car.vin = prevVin;
      }
      const prevIcon = (prev as Device & { icon?: string }).icon;
      const carIcon = (car as Device & { icon?: string }).icon;
      if (!carIcon && prevIcon) {
        (car as Device & { icon?: string }).icon = prevIcon;
      }
    }
    if (car.quickAccess !== false) {
      car.quickAccess = true;
    }
    if (!car.type) {
      car.type = DeviceType.CAR;
    }
    if (!car.moduleId) {
      car.moduleId = this.getModuleId();
    }
    this.deviceManager.saveDevice(car);
  }

  /**
   * Legt ein BMWCar-Device an oder aktualisiert ein bestehendes (Persistenz + Geräteliste).
   */
  async ensureCarDeviceForVin(vin: string): Promise<BMWCar | null> {
    const deviceId = this.deviceIdForVin(vin);
    const existing = this.deviceManager.getDevice(deviceId);
    if (existing) {
      const car =
        existing instanceof BMWCar ? existing : await this.toBMWCar(existing as Device);
      if (!car) return null;
      const displayName = this.resolveVehicleDisplayName(vin);
      if (car.name !== displayName) {
        car.name = displayName;
      }
      car.setBMWController(this.deviceController);
      await car.updateValues();
      this.saveBmwCarPreservingFields(car);
      return car;
    }

    const discovered = new BMWDeviceDiscovered(
      deviceId,
      this.resolveVehicleDisplayName(vin),
      vin,
      "BMW"
    );
    const cars = await this.convertDiscoveredVehiclesToCars([discovered]);
    const car = cars[0];
    if (!car) return null;
    this.saveBmwCarPreservingFields(car);
    logger.info({ deviceId, vin }, "BMW Fahrzeug als DeviceCar gespeichert");
    return car;
  }

  public getModuleId(): string {
    return BMWCONFIG.id;
  }

  protected getManagerId(): string {
    return BMWCONFIG.managerId;
  }

  protected createEventStreamManager(): BMWEventStreamManager {
    return new BMWEventStreamManager(this.getManagerId(), this.getModuleId(), this.deviceController, this.deviceManager);
  }

  /**
   * Nach Server-Neustart / Modul-Registrierung: MQTT-Stream starten, wenn Client-ID und Token in der DB liegen.
   */
  public override startEventStreamsAfterRegistration(): void {
    this.startBmwEventStreamIfConfigured("server_registration");
  }

  private startBmwEventStreamIfConfigured(reason: string): void {
    const info = this.getCredentialsInfo();
    if (!info.hasClientId) {
      logger.info({ reason }, "BMW EventStream: kein Start – Client-ID fehlt");
      return;
    }
    if (!info.hasValidTokens) {
      logger.info({ reason }, "BMW EventStream: kein Start – keine gueltigen Token");
      return;
    }
    logger.info({ reason }, "BMW EventStream: Start mit gespeicherter CarData-Konfiguration");
    this.initialiseEventStreamManager();
  }

  getCredentialsInfo() {
    const cred = this.credentialsStore.getCredentials();
    const hasClientId = this.credentialsStore.hasClientId();
    const hasRefresh = this.tokenStore.hasRefreshToken();
    const refreshExpired = this.tokenStore.isRefreshExpired();
    const hasValidTokens = hasRefresh && !refreshExpired;
    const idTokenExpiresAt = this.tokenStore.getPersisted().idExpiresAt ?? null;
    const lastMessageAtMs = this.deviceController.getLastMessageAt();
    const lastMessageAt = typeof lastMessageAtMs === "number" ? new Date(lastMessageAtMs).toISOString() : null;
    const gcid = this.tokenStore.getGcid();
    return {
      clientId: cred.clientId ?? "",
      mqttHost: cred.mqttHost ?? "",
      mqttPort: typeof cred.mqttPort === "number" ? cred.mqttPort : null,
      hasClientId,
      hasValidTokens,
      mqttConnected: this.deviceController.getMqttConnected(),
      idTokenExpiresAt,
      lastMessageAt,
      gcid: gcid ?? "",
      grantedScope: this.tokenStore.getGrantedScope() ?? "",
      mqttSubscribeTopic: this.tokenStore.getMqttSubscribeTopic() ?? "",
      hasDynamicStreamingScopes: this.tokenStore.hasDynamicStreamingScopes(),
      needsReauth: !hasValidTokens,
      canDiscover: hasClientId && hasValidTokens,
      authPending: this.deviceController.hasPendingDeviceAuth()
    };
  }

  setCarDataConfig(clientId: string, mqttHost?: string, mqttPort?: number) {
    this.credentialsStore.setClientId(clientId);
    const cur = this.credentialsStore.getCredentials();
    const host = mqttHost !== undefined ? mqttHost : cur.mqttHost;
    const port =
      mqttPort !== undefined && Number.isFinite(mqttPort) ? mqttPort : cur.mqttPort;
    this.credentialsStore.setMqttEndpoint(host, port);
    this.startBmwEventStreamIfConfigured("config_saved");
  }

  clearTokens() {
    this.tokenStore.clear();
    this.deviceController.clearPendingAuth();
    this.deviceController.disconnectMqtt();
    if (this.eventStreamManager?.isRunning()) {
      void this.eventStreamManager.stop();
    }
  }

  async startDeviceCodeFlow() {
    return await this.deviceController.startDeviceCodeFlow();
  }

  async pollDeviceTokenOnce() {
    const result = await this.deviceController.pollDeviceTokenOnce();
    if (result.status === "success") {
      this.startBmwEventStreamIfConfigured("oauth_success");
    }
    return result;
  }

  async discoverDevices(): Promise<Device[]> {
    logger.info("BMW Fahrzeug-Discovery ueber CarData MQTT");
    const info = this.getCredentialsInfo();
    if (!info.canDiscover) {
      logger.warn({ info }, "BMW Discovery nicht moeglich");
      return [];
    }
    try {
      const existingIds = this.deviceManager
        .getDevicesForModule(this.getModuleId())
        .map(d => d.id)
        .filter((id): id is string => Boolean(id));

      await this.deviceDiscover.discover(0, existingIds);

      const vins = new Set<string>(this.deviceController.getHub().getSeenVins());
      for (const d of this.deviceDiscover.listStored()) {
        if (d.vin) vins.add(d.vin);
      }

      const cars: BMWCar[] = [];
      for (const vin of vins) {
        this.registeredVins.add(vin);
        const car = await this.ensureCarDeviceForVin(vin);
        if (car) cars.push(car);
      }

      this.startBmwEventStreamIfConfigured("discovery");
      return cars;
    } catch (err) {
      logger.error({ err }, "Fehler bei der BMW Discovery");
      return [];
    }
  }

  getTelemetryKeys() {
    return { keys: BMW_TELEMETRY_KEY_META };
  }

  getTrips(deviceId: string, opts: { fromMs: number; toMs: number }) {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return null;
    const trips = this.deviceManager
      .getBmwTelemetryHistoryStore()
      .getTrips(deviceId, opts.fromMs, opts.toMs);
    return { trips };
  }

  getTelemetryHistory(
    deviceId: string,
    opts: { fromMs: number; toMs: number; keys?: string[] }
  ): { series: Record<string, { time: number; value: unknown }[]> } | null {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return null;
    const keys =
      opts.keys && opts.keys.length > 0
        ? opts.keys.filter(k => (BMW_TRACKED_TELEMETRY_KEYS as readonly string[]).includes(k))
        : [...BMW_TRACKED_TELEMETRY_KEYS];
    const series = this.deviceManager
      .getBmwTelemetryHistoryStore()
      .getSeries(deviceId, keys, opts.fromMs, opts.toMs);
    return { series };
  }

  async refreshDevice(deviceId: string): Promise<boolean> {
    const car = await this.getCar(deviceId);
    if (!car) return false;
    await car.updateValues();
    this.saveBmwCarPreservingFields(car);
    return true;
  }

  private async convertDiscoveredVehiclesToCars(devices: BMWDeviceDiscovered[]): Promise<BMWCar[]> {
    const cars: BMWCar[] = [];
    for (const device of devices) {
      try {
        const car = new BMWCar(device.name ?? BMWCONFIG.defaultDeviceName, device.id, device.vin, this.deviceController);
        await car.updateValues();
        cars.push(car);
      } catch (err) {
        logger.error({ err, deviceId: device.id }, "Fehler beim Initialisieren des BMW Fahrzeugs");
      }
    }
    return cars;
  }

  private async getCar(
    deviceId: string,
    opts?: { refreshTelemetry?: boolean }
  ): Promise<BMWCar | null> {
    const refreshTelemetry = opts?.refreshTelemetry !== false;
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return null;
    if (device instanceof BMWCar) {
      device.setBMWController(this.deviceController);
      if (refreshTelemetry) {
        await device.updateValues();
      }
      return device;
    }
    return await this.toBMWCar(device, refreshTelemetry);
  }

  private async toBMWCar(device: Device, refreshTelemetry = true): Promise<BMWCar | null> {
    const prevConnected = device.isConnected;
    const car = new BMWCar();
    Object.assign(car, device);
    car.moduleId = this.getModuleId();
    if (!((car as any).triggerListeners instanceof Map)) {
      (car as any).triggerListeners = new Map();
    }
    car.setBMWController(this.deviceController);
    if (!car.vin) {
      return null;
    }
    if (refreshTelemetry) {
      await car.updateValues();
    } else if (typeof prevConnected === "boolean") {
      car.isConnected = prevConnected;
    }
    return car;
  }

  async convertDeviceFromDatabase(device: Device): Promise<Device | null> {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }
    const deviceType = device.type as DeviceType;
    const vin = (device as Device & { vin?: string }).vin;
    if (deviceType === DeviceType.CAR || vin) {
      const car = new BMWCar();
      Object.assign(car, device);
      car.setBMWController(this.deviceController);
      await car.updateValues();
      return car;
    }
    return null;
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.deviceManager.getDevicesForModule(this.getModuleId());
    for (const device of devices) {
      if (device instanceof BMWCar) {
        device.setBMWController(this.deviceController);
        if (device.vin) this.registeredVins.add(device.vin);
      } else if ((device as Device & { vin?: string }).vin) {
        const vin = (device as Device & { vin?: string }).vin!;
        this.registeredVins.add(vin);
      }
    }
  }
}
