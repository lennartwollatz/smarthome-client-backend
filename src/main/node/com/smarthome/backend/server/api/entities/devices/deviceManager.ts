import { logger } from "../../../../logger.js";
import { Device } from "../../../../model/devices/Device.js";
import { DeviceSwitch } from "../../../../model/devices/DeviceSwitch.js";
import type { EnergyUsage } from "../../../../model/devices/energyTypes.js";
import { DeviceSpeaker } from "../../../../model/devices/DeviceSpeaker.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { DeviceThermostat } from "../../../../model/devices/DeviceThermostat.js";
import { DeviceMotion } from "../../../../model/devices/DeviceMotion.js";
import { DeviceLightLevel } from "../../../../model/devices/DeviceLightLevel.js";
import { DeviceTemperature } from "../../../../model/devices/DeviceTemperature.js";
import { DeviceLightLevelMotionTemperature } from "../../../../model/devices/DeviceLightLevelMotionTemperature.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { EventManager } from "../../../events/EventManager.js";
import type { LiveUpdateService } from "../../services/live.service.js";
import type { ModuleManager } from "../../modules/moduleManager.js";
import { EntityManager } from "../EntityManager.js";
import { EnergyHistoryArchiveStore } from "../../../db/energyHistoryArchiveStore.js";
import { BmwCarTelemetryHistoryStore } from "../../../db/bmwCarTelemetryHistoryStore.js";
import {
  SensorHistoryStore,
  type SensorHistoryMetric,
  type SensorHistoryRange,
  type MotionHistoryEntry,
  type TemperatureHistoryPoint,
  type LightLevelHistoryPoint
} from "../../../db/sensorHistoryStore.js";
import { VacuumCleaningHistoryStore } from "../../../db/vacuumCleaningHistoryStore.js";
import { DEVICE_MODE, DeviceVacuumCleaner } from "../../../../model/devices/DeviceVacuumCleaner.js";
import { serializeDeviceForApi } from "./deviceSerialize.js";
import type { DeviceChangeLogStore } from "../../../db/deviceChangeLogStore.js";
import { detectDeviceChanges } from "../../../audit/deviceChangeDetector.js";
import { getCurrentSource } from "../../../events/EventSource.js";

type SensorValueSnapshot = {
  motion?: boolean;
  temperature?: number;
  temperatureGoal?: number;
  lightLevel?: number;
};

export class DeviceManager implements EntityManager {
  private deviceRepository: JsonRepository<Device>;
  private energyHistoryArchive: EnergyHistoryArchiveStore;
  private bmwTelemetryHistory: BmwCarTelemetryHistoryStore;
  private sensorHistory: SensorHistoryStore;
  private vacuumCleaningHistory: VacuumCleaningHistoryStore;
  private moduleManagers = new Map<string, ModuleManager<any, any, any, any, any, any, any>>();
  private liveUpdateService?: LiveUpdateService;
  private devices = new Map<string, Device>();
  /** Letzte bekannte Sensorwerte pro Gerät (unabhängig von In-Place-Mutationen im Geräte-Map). */
  private sensorValueSnapshots = new Map<string, SensorValueSnapshot>();

  constructor(
    databaseManager: DatabaseManager,
    private eventManager: EventManager,
    vacuumCleaningHistory: VacuumCleaningHistoryStore,
    private deviceChangeLogStore?: DeviceChangeLogStore
  ) {
    this.deviceRepository = new JsonRepository<Device>(databaseManager, "Device");
    this.energyHistoryArchive = new EnergyHistoryArchiveStore(databaseManager);
    this.bmwTelemetryHistory = new BmwCarTelemetryHistoryStore(databaseManager);
    this.sensorHistory = new SensorHistoryStore(databaseManager);
    this.vacuumCleaningHistory = vacuumCleaningHistory;
    this.initialize();
  }

  getBmwTelemetryHistoryStore(): BmwCarTelemetryHistoryStore {
    return this.bmwTelemetryHistory;
  }

  initialize() {
    this.loadDevicesFromDatabase();
  }

  /**
   * DB-Ladung liefert oft flache Objekte ohne Device-Prototyp — `device.setEventManager` fehlt dann.
   * Prototyp-Aufruf setzt `eventManager` trotzdem korrekt auf dem Objekt.
   */
  private wireEventManager(device: Device): void {
    Device.prototype.setEventManager.call(device, this.eventManager);
  }

  private wireVacuumCleaningHistory(device: Device): void {
    if (device instanceof DeviceVacuumCleaner) {
      device.setCleaningHistoryReader(this.vacuumCleaningHistory);
    }
  }

  setLiveUpdateService(service: LiveUpdateService): void {
    this.liveUpdateService = service;
  }

  loadDevicesFromDatabase(): void {
    const devices = this.deviceRepository.findAll();
    devices.forEach(device => {
      if (device?.id) {
        this.wireEventManager(device);
        this.wireVacuumCleaningHistory(device);
        if (device instanceof DeviceSwitch) {
          if (this.trimAndArchiveSwitchEnergyHistory(device)) {
            this.deviceRepository.save(device.id, serializeDeviceForApi(device) as unknown as Device);
          }
        }
        this.devices.set(device.id, device);
        this.seedSensorValueSnapshot(device);
      }
    });
  }

  registerModuleManager(moduleManager: ModuleManager<any, any, any, any, any, any, any>): void {
    const moduleId = moduleManager.getModuleId();
    this.moduleManagers.set(moduleId, moduleManager);
    const convertPromises = this.getDevicesForModule(moduleId).map(async device => {
      const convertedDevice = await moduleManager.convertDeviceFromDatabase(device);
      if (!convertedDevice) return;
      this.wireEventManager(convertedDevice);
      this.wireVacuumCleaningHistory(convertedDevice);
      this.devices.set(device.id, convertedDevice);
    });
    Promise.all(convertPromises)
      .then(async () => await moduleManager.initializeDeviceControllers())
      .then(async () => moduleManager.updateDeviceValues())
      .then(() => moduleManager.startEventStreamsAfterRegistration())
      .catch(err => {
        logger.error({ err, moduleId }, "Fehler beim Initialisieren der Device-Controller");
      });
  }

  restartEventStreamForModule(moduleId: string): void {
    const mgr = this.moduleManagers.get(moduleId);
    if (mgr && typeof (mgr as { restartEventStream?: () => void }).restartEventStream === "function") {
      (mgr as { restartEventStream: () => void }).restartEventStream();
    }
  }

  getModuleManager(moduleId: string): ModuleManager<any, any, any, any, any, any, any> | undefined {
    return this.moduleManagers.get(moduleId);
  }

  removeRoomFromDevices(roomId: string): void {
    if (!roomId) return;
    this.devices.forEach(device => {
      if (device.room === roomId) {
        device.room = undefined;
        if (device.id) {
          this.deviceRepository.save(device.id, serializeDeviceForApi(device) as unknown as Device);
          if (device.moduleId !== "voice-assistant") {
            this.liveUpdateService?.emit("device:updated", device);
          }
        }
      }
    });
  }

  removeDevicesForModule(moduleId: string): void {
    if (!moduleId) return;
    const devicesToRemove = this.getDevicesForModule(moduleId);
    for (const device of devicesToRemove) {
      this.eventManager.removeListenerForDevice(device.id);
      this.devices.delete(device.id);
      // Event-basierte Trigger dieses Geräts sind entfernt; gespeicherte Workflows/Scenes können verwaiste deviceIds enthalten.
    }
  }

  removeDevice(deviceId: string): boolean {
    if (!deviceId) return false;
    const device = this.devices.get(deviceId);
    const isVoiceAssistant = device?.moduleId === "voice-assistant";
    this.eventManager.removeListenerForDevice(deviceId);
    this.devices.delete(deviceId);
    this.deviceRepository.deleteById(deviceId);
    this.energyHistoryArchive.deleteByDeviceId(deviceId);
    this.bmwTelemetryHistory.deleteByDeviceId(deviceId);
    this.sensorHistory.deleteByDeviceId(deviceId);
    this.sensorValueSnapshots.delete(deviceId);
    this.vacuumCleaningHistory.deleteByDeviceId(deviceId);
    device?.delete();
    // Event-basierte Trigger dieses Geräts sind entfernt; gespeicherte Workflows/Scenes können verwaiste deviceIds enthalten.
    if (!isVoiceAssistant) {
      this.liveUpdateService?.emit("device:removed", { deviceId });
    }
    return true;
  }

  saveDevices(devices: Device[]): boolean {
    return devices.every(device => this.saveDevice(device));
  }

  saveDevice(device: Device): boolean {
    if (!device?.id) return false;
    const prev = this.devices.get(device.id);
    this.wireEventManager(device);
    this.wireVacuumCleaningHistory(device);
    if (device instanceof DeviceSwitch) {
      this.trimAndArchiveSwitchEnergyHistory(device);
    }
    this.recordSensorHistoryIfChanged(prev, device);
    this.recordVacuumCleaningHistoryIfCompleted(prev, device);
    this.recordDeviceChangesIfAny(prev, device);
    this.devices.set(device.id, device);
    this.deviceRepository.save(device.id, serializeDeviceForApi(device) as unknown as Device);
    if (device.moduleId !== "voice-assistant") {
      this.liveUpdateService?.emit("device:updated", device);
    }
    return true;
  }

  private recordDeviceChangesIfAny(prev: Device | undefined, device: Device): void {
    if (!this.deviceChangeLogStore || !prev) return;
    try {
      const prevSnap = serializeDeviceForApi(prev);
      const nextSnap = serializeDeviceForApi(device);
      const changes = detectDeviceChanges(prevSnap, nextSnap);
      if (!changes.length) return;
      this.deviceChangeLogStore.append(
        device.id,
        device.name ?? device.id,
        changes,
        getCurrentSource()
      );
    } catch {
      /* Protokollierung darf Speichern nicht blockieren */
    }
  }

  queryDeviceChangeLog(query: Parameters<DeviceChangeLogStore["query"]>[0] = {}) {
    return this.deviceChangeLogStore?.query(query) ?? { total: 0, items: [] };
  }

  /**
   * Verschiebt Messpunkte älter als 48 Stunden ins Archiv und behält nur das Live-Fenster im Gerät.
   * @returns true, wenn Live-Daten gekürzt oder archiviert wurden
   */
  private trimAndArchiveSwitchEnergyHistory(device: DeviceSwitch): boolean {
    if (!device.id) return false;
    const cutoff = Date.now() - DeviceSwitch.ENERGY_USAGE_LIVE_WINDOW_MS;
    let changed = false;

    for (const [buttonId, btn] of Object.entries(device.buttons ?? {})) {
      if (!btn?.energyUsages?.length) continue;
      const beforeLen = btn.energyUsages.length;
      const toArchive = btn.energyUsages.filter(u => u.time < cutoff);
      if (toArchive.length > 0) {
        this.energyHistoryArchive.appendPruned(device.id, buttonId, toArchive);
        changed = true;
      }
      const trimmed = btn.energyUsages.filter(u => u.time >= cutoff);
      if (trimmed.length !== beforeLen) {
        btn.energyUsages = trimmed;
        changed = true;
      }
    }
    return changed;
  }

  private parseCleanSequenceFromPatch(raw: unknown): string[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    const out: string[] = [];
    for (const el of raw) {
      if (typeof el === "string" && el.trim() !== "") {
        out.push(el.trim());
      } else if (typeof el === "number" && Number.isFinite(el)) {
        out.push(String(Math.round(el)));
      } else {
        return undefined;
      }
    }
    return out;
  }

  private cleanSequencesEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }

  /**
   * Wendet den JSON-Body von PUT /api/devices/:id an (Metadaten, Buttons, Koordinaten, …).
   * Bei Thermostaten wird geänderte `temperatureGoal` per {@link DeviceThermostat.setTemperatureGoal} an das Gerät gesendet (z. B. Matter).
   * Bei Staubsaugern wird geänderte `cleanSequence` per {@link DeviceVacuumCleaner.setCleanSequence} an das Gerät gesendet.
   * @returns aktualisiertes Gerät oder `null`, wenn kein Gerät existiert oder der Patch ungültig ist.
   */
  async updateDeviceSettings(deviceId: string, patch: Record<string, unknown>): Promise<Device | null> {
    logger.error({ deviceId, patch }, "updateDeviceSettings");
    const existing = this.getDevice(deviceId);
    if (!existing) {
      return null;
    }

    const patchForApply: Record<string, unknown> = { ...patch };

    if ("temperatureGoal" in patchForApply) {
      delete patchForApply["temperatureGoal"];
    }

    if ("cleanSequence" in patchForApply && existing instanceof DeviceVacuumCleaner) {
      const seq = this.parseCleanSequenceFromPatch(patchForApply["cleanSequence"]);
      if (seq !== undefined && !this.cleanSequencesEqual(existing.cleanSequence, seq)) {
        try {
          await existing.setCleanSequence(seq, true, true);
        } catch (err) {
          logger.error({ err, deviceId }, "setCleanSequence fehlgeschlagen");
          throw err;
        }
      }
    }

    this.applyApiPatchToDevice(existing, patchForApply);
    this.saveDevice(existing);
    return existing;
  }

  private applyApiPatchToDevice(device: Device, patch: Record<string, unknown>): void {
    const next = device as Device & Record<string, unknown>;

    if ("name" in patch && typeof patch.name === "string") next.name = patch.name;
    if ("room" in patch && (typeof patch.room === "string" || patch.room === undefined || patch.room === null)) {
      next.room = patch.room ?? undefined;
    }
    if ("icon" in patch && (typeof patch.icon === "string" || patch.icon === undefined)) next.icon = patch.icon;
    if ("typeLabel" in patch && (typeof patch.typeLabel === "string" || patch.typeLabel === undefined)) {
      next.typeLabel = patch.typeLabel;
    }
    if ("quickAccess" in patch && typeof patch.quickAccess === "boolean") next.quickAccess = patch.quickAccess;
    if ("latitude" in patch && typeof patch.latitude === "number" && Number.isFinite(patch.latitude)) {
      next.latitude = patch.latitude;
    }
    if ("longitude" in patch && typeof patch.longitude === "number" && Number.isFinite(patch.longitude)) {
      next.longitude = patch.longitude;
    }
    if ("roomMapping" in patch && typeof patch.roomMapping === "object" && patch.roomMapping !== null) {
      next.roomMapping = patch.roomMapping as Record<string, { name: string; id: string; segmentId: string }>;
    }
    if ("cleanSequence" in patch && device instanceof DeviceVacuumCleaner) {
      const seq = this.parseCleanSequenceFromPatch(patch["cleanSequence"]);
      if (seq !== undefined) {
        device.cleanSequence = [...seq];
      }
    }
    if ("buttons" in patch && typeof patch.buttons === "object" && patch.buttons !== null) {
      const incomingButtons = patch.buttons as Record<string, unknown>;
      const existingButtons = next.buttons as Record<string, Record<string, unknown>> | undefined;

      if (existingButtons && typeof existingButtons === "object") {
        for (const [buttonId, rawButtonPatch] of Object.entries(incomingButtons)) {
          const existingButton = existingButtons[buttonId];
          if (!existingButton || typeof existingButton !== "object") continue;
          if (!rawButtonPatch || typeof rawButtonPatch !== "object") continue;

          const buttonPatch = rawButtonPatch as Record<string, unknown>;
          if ("name" in buttonPatch && typeof buttonPatch.name === "string") {
            existingButton.name = buttonPatch.name;
          }
          if ("connectedToLight" in buttonPatch && typeof buttonPatch.connectedToLight === "boolean") {
            existingButton.connectedToLight = buttonPatch.connectedToLight;
          }
        }
      }
    }
  }

  getDevice(deviceId: string): Device | null {
    const d = this.devices.get(deviceId) ?? null;
    if (d) {
      this.wireEventManager(d);
    }
    return d;
  }

  getDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  getDevicesMap(): Map<string, Device> {
    return this.devices;
  }

  getDevicesForModule(moduleId: string): Device[] {
    return Array.from(this.getDevices()).filter(device => device.moduleId === moduleId);
  }

  /**
   * Gruppiert Lautsprecher desselben Moduls. `speakerIds[0]` ist der Koordinator/Anführer,
   * die übrigen IDs werden der Gruppe zugeordnet (Reihenfolge wie übergeben).
   */
  async groupSpeakersByIds(speakerIds: string[]): Promise<Device[]> {
    if (!Array.isArray(speakerIds) || speakerIds.length < 2) {
      throw new Error("Mindestens zwei Lautsprecher-IDs sind erforderlich.");
    }
    const uniqueCheck = new Set(speakerIds);
    if (uniqueCheck.size !== speakerIds.length) {
      throw new Error("Doppelte Geräte-IDs in der Gruppe sind nicht erlaubt.");
    }
    const resolved: Device[] = [];
    for (const id of speakerIds) {
      const d = this.getDevice(id);
      if (!d) {
        throw new Error(`Gerät nicht gefunden: ${id}`);
      }
      resolved.push(d);
    }
    const moduleId = resolved[0].moduleId;
    if (!moduleId || !resolved.every(d => d.moduleId === moduleId)) {
      throw new Error("Alle Geräte müssen demselben Modul angehören.");
    }
    if (!resolved.every(d => d.type === DeviceType.SPEAKER || d.type === DeviceType.SPEAKER_RECEIVER)) {
      throw new Error("Nur Lautsprecher und AV-Receiver (Speaker-Module) können gruppiert werden.");
    }
    const speakers = await this.ensureDeviceSpeakerInstances(resolved);
    const leader = speakers[0];
    await leader.groupWith(speakers, true, true);
    for (const d of speakers) {
      this.saveDevice(d);
    }
    return speakers;
  }

  /**
   * Löst ein Gerät aus seiner Lautsprecher-Gruppe: Hardware-Leave, `groupedWith` des Aufrufers leer.
   * Verbleibende Mitglieder: ein Gerät → `groupedWith` leer; sonst {@link DeviceSpeaker#groupWith}
   * mit neuer Reihenfolge (erste verbleibende ID = Anführer).
   */
  async ungroupSpeakerById(deviceId: string): Promise<Device[]> {
    const raw = this.getDevice(deviceId);
    if (!raw) {
      throw new Error(`Gerät nicht gefunden: ${deviceId}`);
    }
    if (raw.type !== DeviceType.SPEAKER && raw.type !== DeviceType.SPEAKER_RECEIVER) {
      throw new Error("Nur Lautsprecher und AV-Receiver können aus Gruppen gelöst werden.");
    }
    const [device] = await this.ensureDeviceSpeakerInstances([raw]);
    const groupedIds = device.groupedWith ?? [];
    const resolved: Device[] = [];
    for (const id of groupedIds) {
      const d = this.getDevice(id);
      if (!d) {
        throw new Error(`Gerät nicht gefunden: ${id}`);
      }
      resolved.push(d);
    }
    const speakersGroup = await this.ensureDeviceSpeakerInstances(resolved);
    await device.ungroup(speakersGroup, true, true);
    return resolved;
  }

  /**
   * Stellt sicher, dass Geräte echte {@link DeviceSpeaker}-Subklassen sind (Methoden, Controller).
   * Roh-JSON aus der DB hat keinen Prototyp – `instanceof DeviceSpeaker` schlägt fehl, bis das Modul
   * konvertiert hat; teils liegt die Konvertierung noch aus oder ein Gerät war noch nicht ersetzt.
   */
  private async ensureDeviceSpeakerInstances(devices: Device[]): Promise<DeviceSpeaker[]> {
    const speakers: DeviceSpeaker[] = [];
    for (const d of devices) {
      if (d instanceof DeviceSpeaker) {
        speakers.push(d);
        continue;
      }
      const mid = d.moduleId;
      if (!mid) {
        throw new Error(`Gerät ${d.id} hat keine moduleId – Gruppierung nicht möglich.`);
      }
      const mgr = this.moduleManagers.get(mid);
      if (!mgr) {
        throw new Error(`Kein Modul-Manager für „${mid}“ registriert – Gerät ${d.id} kann nicht gruppiert werden.`);
      }
      const converted = await mgr.convertDeviceFromDatabase(d);
      if (!converted || !(converted instanceof DeviceSpeaker)) {
        throw new Error(
          `Gerät „${d.name ?? d.id}“ (${d.id}) kann für diese Modul-Integration nicht als Lautsprecher instanziiert werden.`
        );
      }
      if (converted.id) {
        this.wireEventManager(converted);
        this.devices.set(converted.id, converted);
      }
      speakers.push(converted);
    }
    return speakers;
  }

  addDevicesForModule(moduleId: string): void {
    const devices = this.getDevicesForModule(moduleId);
    for (const device of devices) {
      this.saveDevice(device);
    }
  }

  /**
   * Verlauf kWh pro Slot (5-Min-Takt) für switch-energy o. ä.:
   * Live-Daten (letzte 48 Stunden im Gerät) plus optionales Archiv (älter, begrenzt auf ca. 400 Tage).
   */
  getSwitchEnergyHistory(
    deviceId: string,
    opts: { fromMs: number; toMs: number; buttonId?: string; includeArchive: boolean }
  ): { buttons: Record<string, EnergyUsage[]> } | null {
    const device = this.devices.get(deviceId);
    if (!device || !(device instanceof DeviceSwitch)) {
      return null;
    }
    const buttonIds = opts.buttonId
      ? [opts.buttonId].filter(bid => device.buttons?.[bid])
      : Object.keys(device.buttons ?? {});
    const out: Record<string, EnergyUsage[]> = {};
    for (const bid of buttonIds) {
      const btn = device.buttons[bid];
      const liveArr = (btn?.energyUsages ?? []) as EnergyUsage[];
      const live = liveArr.filter(u => u.time >= opts.fromMs && u.time <= opts.toMs);
      if (!opts.includeArchive) {
        out[bid] = [...live].sort((a, b) => a.time - b.time);
        continue;
      }
      const arch = this.energyHistoryArchive.getForButtonInRange(deviceId, bid, opts.fromMs, opts.toMs);
      const byTime = new Map<number, EnergyUsage>();
      for (const u of arch) {
        byTime.set(u.time, u);
      }
      for (const u of live) {
        byTime.set(u.time, u);
      }
      out[bid] = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
    }
    return { buttons: out };
  }

  private static readonly VACUUM_ACTIVE_CLEANING_MODES = new Set<DEVICE_MODE>([
    DEVICE_MODE.CLEANING,
    DEVICE_MODE.CLEANING_ROOM,
    DEVICE_MODE.CLEANING_ZONED,
    DEVICE_MODE.DOCKING,
  ]);

  private static readonly VACUUM_CLEANING_COMPLETED_MODES = new Set<DEVICE_MODE>([
    DEVICE_MODE.DOCKED,
    DEVICE_MODE.SLEEPING,
    DEVICE_MODE.CLEANING_STOPPED,
    DEVICE_MODE.CLEANING_ROOM_STOPPED,
    DEVICE_MODE.CLEANING_ZONED_STOPPED,
  ]);

  private recordVacuumCleaningHistoryIfCompleted(prev: Device | undefined, next: Device): void {
    if (!next.id || !(next instanceof DeviceVacuumCleaner)) return;
    const prevMode = prev instanceof DeviceVacuumCleaner ? prev.deviceState.mode : undefined;
    const nextMode = next.deviceState.mode;
    if (
      prevMode === undefined ||
      !DeviceManager.VACUUM_ACTIVE_CLEANING_MODES.has(prevMode) ||
      !DeviceManager.VACUUM_CLEANING_COMPLETED_MODES.has(nextMode)
    ) {
      return;
    }
    const rooms =
      prev instanceof DeviceVacuumCleaner && prev.deviceState.currentRooms?.length
        ? [...prev.deviceState.currentRooms]
        : next.deviceState.currentRooms?.length
          ? [...next.deviceState.currentRooms]
          : [];
    this.vacuumCleaningHistory.recordCleaning(next.id, {
      mode: nextMode,
      rooms,
    });
  }

  private seedSensorValueSnapshot(device: Device): void {
    if (!device.id || this.sensorValueSnapshots.has(device.id)) return;
    this.sensorValueSnapshots.set(device.id, this.readSensorValueSnapshot(device));
  }

  private readSensorValueSnapshot(device: Device): SensorValueSnapshot {
    return {
      motion: this.readMotion(device),
      temperature: this.readTemperature(device),
      temperatureGoal: this.readTemperatureGoal(device),
      lightLevel: this.readLightLevel(device)
    };
  }

  private recordSensorHistoryIfChanged(_prev: Device | undefined, next: Device): void {
    if (!next.id) return;
    const now = Date.now();
    const id = next.id;

    if (!this.sensorValueSnapshots.has(id)) {
      this.sensorValueSnapshots.set(id, this.readSensorValueSnapshot(next));
      return;
    }

    const snap = this.sensorValueSnapshots.get(id)!;

    const nextMotion = this.readMotion(next);
    if (nextMotion !== undefined && snap.motion !== nextMotion) {
      this.sensorHistory.appendMotion(id, nextMotion, now);
    }

    const nextTemp = this.readTemperature(next);
    const nextGoal = this.readTemperatureGoal(next);
    if (nextTemp !== undefined && (snap.temperature !== nextTemp || snap.temperatureGoal !== nextGoal)) {
      this.sensorHistory.appendTemperature(id, nextTemp, nextGoal, now);
    }

    const nextLl = this.readLightLevel(next);
    if (nextLl !== undefined && snap.lightLevel !== nextLl) {
      this.sensorHistory.appendLightLevel(id, nextLl, now);
    }

    this.sensorValueSnapshots.set(id, this.readSensorValueSnapshot(next));
  }

  private readMotion(device: Device | undefined): boolean | undefined {
    if (!device) return undefined;
    if (device instanceof DeviceMotion || device instanceof DeviceLightLevelMotionTemperature) {
      return device.motion === true;
    }
    return undefined;
  }

  private readTemperature(device: Device | undefined): number | undefined {
    if (!device) return undefined;
    if (device instanceof DeviceTemperature || device instanceof DeviceLightLevelMotionTemperature) {
      const t = device.temperature;
      return t !== undefined && Number.isFinite(t) ? t : undefined;
    }
    return undefined;
  }

  private readTemperatureGoal(device: Device | undefined): number | undefined {
    if (!device || !(device instanceof DeviceThermostat)) return undefined;
    const g = device.temperatureGoal;
    if (g === undefined || !Number.isFinite(g) || g === -999) return undefined;
    return g;
  }

  private readLightLevel(device: Device | undefined): number | undefined {
    if (!device) return undefined;
    if (device instanceof DeviceLightLevel || device instanceof DeviceLightLevelMotionTemperature) {
      const ll = device.lightLevel;
      return ll !== undefined && Number.isFinite(ll) ? ll : undefined;
    }
    return undefined;
  }

  /**
   * Sensor-Verlauf für motion, temperature (inkl. Thermostat-Sollwert) und lightLevel.
   */
  getSensorHistory(
    deviceId: string,
    metric: SensorHistoryMetric,
    range: SensorHistoryRange
  ):
    | { metric: "motion"; entries: MotionHistoryEntry[] }
    | { metric: "temperature"; range: SensorHistoryRange; points: TemperatureHistoryPoint[] }
    | { metric: "lightLevel"; range: SensorHistoryRange; points: LightLevelHistoryPoint[] }
    | null {
    const device = this.devices.get(deviceId);
    if (!device) return null;

    if (metric === "motion") {
      if (!(device instanceof DeviceMotion || device instanceof DeviceLightLevelMotionTemperature)) {
        return null;
      }
      return { metric: "motion", entries: this.sensorHistory.getMotion(deviceId) };
    }

    if (metric === "temperature") {
      if (!(device instanceof DeviceTemperature || device instanceof DeviceLightLevelMotionTemperature)) {
        return null;
      }
      let points = this.sensorHistory.getTemperature(deviceId, range);
      if (points.length === 0) {
        const value = this.readTemperature(device);
        if (value !== undefined) {
          points = [{ time: Date.now(), value, goal: this.readTemperatureGoal(device) }];
        }
      }
      return {
        metric: "temperature",
        range,
        points
      };
    }

    if (metric === "lightLevel") {
      if (!(device instanceof DeviceLightLevel || device instanceof DeviceLightLevelMotionTemperature)) {
        return null;
      }
      let points = this.sensorHistory.getLightLevel(deviceId, range);
      if (points.length === 0) {
        const value = this.readLightLevel(device);
        if (value !== undefined) {
          points = [{ time: Date.now(), value }];
        }
      }
      return {
        metric: "lightLevel",
        range,
        points
      };
    }

    return null;
  }
}
