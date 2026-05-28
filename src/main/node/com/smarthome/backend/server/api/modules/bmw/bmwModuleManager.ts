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
import { BMWCarTripCategoriesStore } from "./bmwCarTripCategoriesStore.js";
import { isBmwTripCategory, type BmwTripCategory } from "./bmwCarTripCategory.js";
import { applyTripCategoriesToEntries } from "./bmwCarTripCategoryApplier.js";
import { buildGroupedTripEntriesFast } from "./bmwCarTripEnricher.js";
import { computeTripYearSummary, yearBoundsMs } from "./bmwCarTripYearSummary.js";
import { BMWCarHomeStore, type BmwCarHome } from "./bmwCarHomeStore.js";
import {
  BMWCarLearnedPlacesStore,
  type BmwLearnedPlace
} from "./bmwCarLearnedPlacesStore.js";
import {
  BMWCarFuelSettingsStore,
  type BmwCarFuelSettings,
  BMW_TANK_CAPACITY_MIN_LITERS,
  BMW_TANK_CAPACITY_MAX_LITERS
} from "./bmwCarFuelSettingsStore.js";
import {
  autoCategorizeTripEntries,
  observationsFromCategorizedEntry
} from "./bmwCarTripAutoCategorizer.js";
import type { BmwCarTripEntry } from "./bmwCarTripGrouper.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { BMW_TRACKED_TELEMETRY_KEYS, BMW_TELEMETRY_KEY_META } from "./bmwCarDataTelemetryKeys.js";
import type { EventLogStore } from "../../../db/eventLogStore.js";

/** Extrahiert die Start-ms aus einer entry-/group-id (`trip-<ms>` oder `group-trip-<ms>`). */
function parseEntryStartMs(entryId: string): number | null {
  const match = entryId.match(/trip-(\d+)$/);
  if (!match) return null;
  const ms = Number(match[1]);
  return Number.isFinite(ms) ? ms : null;
}

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
  private tripCategoriesStore: BMWCarTripCategoriesStore;
  private homeStore: BMWCarHomeStore;
  private learnedPlacesStore: BMWCarLearnedPlacesStore;
  private fuelSettingsStore: BMWCarFuelSettingsStore;
  private readonly registeredVins = new Set<string>();

  constructor(
    databaseManager: DatabaseManager,
    deviceManager: DeviceManager,
    eventManager: EventManager,
    eventLogStore?: EventLogStore
  ) {
    const tokenStore = new BMWTokenStore(databaseManager);
    const credentialsStore = new BMWCredentialsStore(databaseManager);
    const vehicleNamesStore = new BMWVehicleNamesStore(databaseManager);
    const tripCategoriesStore = new BMWCarTripCategoriesStore(databaseManager);
    const homeStore = new BMWCarHomeStore(databaseManager);
    const learnedPlacesStore = new BMWCarLearnedPlacesStore(databaseManager);
    const fuelSettingsStore = new BMWCarFuelSettingsStore(databaseManager);
    const telemetryHistory = deviceManager.getBmwTelemetryHistoryStore();
    const deviceController = new BMWDeviceController(
      tokenStore,
      credentialsStore,
      telemetryHistory,
      eventLogStore
    );
    const deviceDiscover = new BMWDeviceDiscover(databaseManager, deviceController);

    super(databaseManager, deviceManager, eventManager, deviceController, deviceDiscover);
    this.credentialsStore = credentialsStore;
    this.tokenStore = tokenStore;
    this.vehicleNamesStore = vehicleNamesStore;
    this.tripCategoriesStore = tripCategoriesStore;
    this.homeStore = homeStore;
    this.learnedPlacesStore = learnedPlacesStore;
    this.fuelSettingsStore = fuelSettingsStore;

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

  getAvailableTripMonths(deviceId: string): { months: { year: number; month: number }[] } | null {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return null;
    const months = this.deviceManager.getBmwTelemetryHistoryStore().getAvailableTripMonths(deviceId);
    return { months };
  }

  async getTrips(deviceId: string, opts: { fromMs: number; toMs: number }) {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return null;
    const tankCapacityLiters = this.fuelSettingsStore.getCapacityLiters(deviceId);
    const trips = this.deviceManager
      .getBmwTelemetryHistoryStore()
      .getTrips(deviceId, opts.fromMs, opts.toMs, { tankCapacityLiters });
    const { buildGroupedTripEntries } = await import("./bmwCarTripEnricher.js");
    const entries = await buildGroupedTripEntries(trips);
    return { entries: this.applyCategoriesAndAuto(deviceId, entries) };
  }

  setTripCategory(
    deviceId: string,
    entryId: string,
    category: BmwTripCategory | null
  ): { success: boolean; category?: BmwTripCategory } | null {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return null;
    const trimmed = entryId.trim();
    if (!trimmed) return { success: false };
    if (category != null && !isBmwTripCategory(category)) {
      return { success: false };
    }
    const previous = this.tripCategoriesStore.getCategory(deviceId, trimmed);
    this.tripCategoriesStore.setCategory(deviceId, trimmed, category);

    const entry = this.findTripEntryById(deviceId, trimmed);
    if (entry?.grouped) {
      for (const seg of entry.segments) {
        this.tripCategoriesStore.setCategory(deviceId, seg.id, category);
      }
    }

    try {
      this.updateLearnedPlacesForEntry(deviceId, trimmed, previous, category);
    } catch (err) {
      logger.warn({ err, deviceId, entryId: trimmed }, "BMW: gelernte Orte konnten nicht aktualisiert werden");
    }
    return { success: true, category: category ?? undefined };
  }

  /** Sucht einen gruppierten oder einzelnen Trip-Eintrag anhand seiner entryId. */
  private findTripEntryById(deviceId: string, entryId: string): BmwCarTripEntry | undefined {
    const startMs = parseEntryStartMs(entryId);
    if (startMs == null) return undefined;
    const windowMs = 7 * 24 * 60 * 60 * 1000;
    const tankCapacityLiters = this.fuelSettingsStore.getCapacityLiters(deviceId);
    const trips = this.deviceManager
      .getBmwTelemetryHistoryStore()
      .getTrips(deviceId, startMs - windowMs, startMs + windowMs, { tankCapacityLiters });
    if (trips.length === 0) return undefined;
    const entries = buildGroupedTripEntriesFast(trips);
    return entries.find(e => e.id === entryId);
  }

  getTripCategories(deviceId: string): Record<string, BmwTripCategory> | null {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return null;
    return this.tripCategoriesStore.getAllForDevice(deviceId);
  }

  getTripYearSummary(deviceId: string, year?: number) {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return null;

    const y = year != null && Number.isFinite(year) ? Math.floor(year) : new Date().getFullYear();
    const { fromMs, toMs } = yearBoundsMs(y);
    const tankCapacityLiters = this.fuelSettingsStore.getCapacityLiters(deviceId);

    const rawTrips = this.deviceManager
      .getBmwTelemetryHistoryStore()
      .getTrips(deviceId, fromMs, toMs, { tankCapacityLiters });
    const entries = buildGroupedTripEntriesFast(rawTrips);
    const withCategories = this.applyCategoriesAndAuto(deviceId, entries);

    return computeTripYearSummary(withCategories, y);
  }

  getHome(deviceId: string): BmwCarHome | null {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return null;
    return this.homeStore.getHome(deviceId) ?? null;
  }

  setHome(
    deviceId: string,
    latitude: number,
    longitude: number,
    label?: string
  ): BmwCarHome | null {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return null;
    return this.homeStore.setHome(deviceId, latitude, longitude, label);
  }

  clearHome(deviceId: string): boolean {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return false;
    this.homeStore.clearHome(deviceId);
    return true;
  }

  getLearnedPlaces(deviceId: string): BmwLearnedPlace[] | null {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return null;
    return this.learnedPlacesStore.getAll(deviceId);
  }

  deleteLearnedPlace(deviceId: string, placeId: string): boolean {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return false;
    return this.learnedPlacesStore.deletePlace(deviceId, placeId);
  }

  getFuelSettings(deviceId: string): BmwCarFuelSettings | null {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return null;
    return this.fuelSettingsStore.getSettings(deviceId);
  }

  setFuelSettings(
    deviceId: string,
    tankCapacityLiters: number
  ): { ok: true; settings: BmwCarFuelSettings } | { ok: false; reason: "device-not-found" | "invalid-capacity" } {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return { ok: false, reason: "device-not-found" };
    const settings = this.fuelSettingsStore.setCapacity(deviceId, tankCapacityLiters);
    if (!settings) return { ok: false, reason: "invalid-capacity" };
    return { ok: true, settings };
  }

  resetFuelSettings(deviceId: string): BmwCarFuelSettings | null {
    const car = this.deviceManager.getDevice(deviceId);
    if (!car || !(car instanceof BMWCar)) return null;
    return this.fuelSettingsStore.reset(deviceId);
  }

  /** Wendet manuelle Kategorien an und ergänzt fehlende Kategorien anhand gelernter Orte. */
  private applyCategoriesAndAuto(
    deviceId: string,
    entries: BmwCarTripEntry[]
  ): BmwCarTripEntry[] {
    const categories = this.tripCategoriesStore.getAllForDevice(deviceId);
    const withManual = applyTripCategoriesToEntries(entries, categories);
    const home = this.homeStore.getHome(deviceId);
    return autoCategorizeTripEntries(withManual, {
      home: home ?? null,
      lookupPlace: (lat, lng) => this.learnedPlacesStore.findNearest(deviceId, lat, lng)
    });
  }

  /**
   * Aktualisiert die gelernten Orte nach einer User-Kategorisierung. Sucht den entry
   * anhand der entryId-Konvention `trip-<startMs>` / `group-trip-<startMs>` in einem
   * konservativen Zeitfenster (±7 Tage) der Telemetrie-Historie und lernt jeden
   * Nicht-Home-Endpunkt der Fahrt.
   */
  private updateLearnedPlacesForEntry(
    deviceId: string,
    entryId: string,
    previous: BmwTripCategory | undefined,
    next: BmwTripCategory | null
  ): void {
    if (previous === (next ?? undefined)) return;

    const startMs = parseEntryStartMs(entryId);
    if (startMs == null) return;

    const windowMs = 7 * 24 * 60 * 60 * 1000;
    const tankCapacityLiters = this.fuelSettingsStore.getCapacityLiters(deviceId);
    const trips = this.deviceManager
      .getBmwTelemetryHistoryStore()
      .getTrips(deviceId, startMs - windowMs, startMs + windowMs, { tankCapacityLiters });
    if (trips.length === 0) return;

    const entries = buildGroupedTripEntriesFast(trips);
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const home = this.homeStore.getHome(deviceId);
    const observations = observationsFromCategorizedEntry(entry, home);
    if (observations.length === 0) return;

    for (const obs of observations) {
      if (previous && previous !== next) {
        this.learnedPlacesStore.retractObservation(deviceId, obs.lat, obs.lng, previous);
      }
      if (next) {
        this.learnedPlacesStore.registerObservation(deviceId, obs.lat, obs.lng, next, obs.label);
      }
    }
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
