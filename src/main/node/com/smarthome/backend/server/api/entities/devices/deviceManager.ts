import { logger } from "../../../../logger.js";
import { Device } from "../../../../model/devices/Device.js";
import { DeviceSpeaker } from "../../../../model/devices/DeviceSpeaker.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { DeviceThermostat } from "../../../../model/devices/DeviceThermostat.js";
import { DeviceVacuumCleaner } from "../../../../model/devices/DeviceVacuumCleaner.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { EventManager } from "../../../events/EventManager.js";
import type { LiveUpdateService } from "../../services/live.service.js";
import type { ModuleManager } from "../../modules/moduleManager.js";
import { EntityManager } from "../EntityManager.js";

export class DeviceManager implements EntityManager {
  private deviceRepository: JsonRepository<Device>;
  private moduleManagers = new Map<string, ModuleManager<any, any, any, any, any, any, any>>();
  private liveUpdateService?: LiveUpdateService;
  private devices = new Map<string, Device>();

  constructor(databaseManager: DatabaseManager, private eventManager: EventManager) {
    this.deviceRepository = new JsonRepository<Device>(databaseManager, "Device");
    this.initialize();
  }

  initialize() {
    this.loadDevicesFromDatabase();
  }

  setLiveUpdateService(service: LiveUpdateService): void {
    this.liveUpdateService = service;
  }

  loadDevicesFromDatabase(): void {
    const devices = this.deviceRepository.findAll();
    devices.forEach(device => {
      if (device?.id) {
        this.devices.set(device.id, device);
      }
    });
  }

  registerModuleManager(moduleManager: ModuleManager<any, any, any, any, any, any, any>): void {
    const moduleId = moduleManager.getModuleId();
    this.moduleManagers.set(moduleId, moduleManager);
    const convertPromises = this.getDevicesForModule(moduleId).map(async device => {
      const convertedDevice = await moduleManager.convertDeviceFromDatabase(device);
      if (!convertedDevice) return;
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
          this.deviceRepository.save(device.id, device);
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
    this.devices.set(device.id, device);
    this.deviceRepository.save(device.id, device);
    if (device.moduleId !== "voice-assistant") {
      this.liveUpdateService?.emit("device:updated", device);
    }
    return true;
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
    const existing = this.getDevice(deviceId);
    if (!existing) {
      console.log("Device " + deviceId + " not found");
      return null;
    }

    const patchForApply: Record<string, unknown> = { ...patch };

    if ("temperatureGoal" in patch) {
      console.log(patchForApply);
      delete patchForApply["temperatureGoal"];
      console.log(patchForApply);
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
    console.log(this.devices);
    return this.devices.get(deviceId) ?? null;
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
}
