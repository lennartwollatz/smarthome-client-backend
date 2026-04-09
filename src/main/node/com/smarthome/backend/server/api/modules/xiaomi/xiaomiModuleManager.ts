import type { DatabaseManager } from "../../../db/database.js";
import { logger } from "../../../../logger.js";
import { ModuleManager } from "../moduleManager.js";
import { XiaomiDeviceController } from "./xiaomiDeviceController.js";
import { XiaomiDeviceDiscovered } from "./xiaomiDeviceDiscovered.js";
import { XiaomiDeviceDiscover } from "./xiaomiDeviceDiscover.js";
import { DEVICE_MODE, DeviceVacuumCleaner, WIPER_INTENSITY } from "../../../../model/devices/DeviceVacuumCleaner.js";
import { XiaomiVacuumCleaner } from "./devices/xiaomiVacuumCleaner.js";
import { XiaomiEvent } from "./xiaomiEvent.js";
import { Device } from "../../../../model/devices/Device.js";
import { XiaomiEventStreamManager } from "./xiaomiEventStreamManager.js";
import { EventManager } from "../../../events/EventManager.js";
import { XIAOMICONFIG } from "./xiaomiModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";

export type StartCleaningRoomOptions = {
  cleaningMode?: number;
  vacuumIntensity?: number;
  wiperIntensity?: string;
  repeatTimes?: number;
};

function coerceWiperIntensity(raw: unknown): WIPER_INTENSITY | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toLowerCase();
  const vals = Object.values(WIPER_INTENSITY) as string[];
  return vals.includes(v) ? (v as WIPER_INTENSITY) : undefined;
}

export class XiaomiModuleManager extends ModuleManager<XiaomiEventStreamManager, XiaomiDeviceController, XiaomiDeviceController, XiaomiEvent, DeviceVacuumCleaner, XiaomiDeviceDiscover, XiaomiDeviceDiscovered> {

  constructor(
    databaseManager: DatabaseManager,
    deviceManager: DeviceManager,
    eventManager: EventManager
  ) {
    super(
      databaseManager, 
      deviceManager, 
      eventManager, 
      new XiaomiDeviceController(), 
      new XiaomiDeviceDiscover(databaseManager));
  }

  public getModuleId(): string {
    return XIAOMICONFIG.id;
  }
  protected getManagerId(): string {
    return XIAOMICONFIG.managerId;
  }

  protected createEventStreamManager(): XiaomiEventStreamManager {
    return new XiaomiEventStreamManager(this.getManagerId(), this.deviceController, this.deviceManager);
  }

  async discoverDevices(): Promise<Device[]> {
    logger.info("Suche nach Xiaomi-Geraeten");
    try {
      const discoveredDevices = await this.deviceDiscover.discover(20, []);
      logger.info({ count: discoveredDevices.length }, "Geraete gefunden");

      // Konvertierung und Persistenz bei Discovery wie bei Denon HEOS — Geräte sind direkt nutzbar.
      const vacuumCleaners = await this.convertDiscoveredDevicesToVacuumCleaners(discoveredDevices);
      this.deviceManager.saveDevices(vacuumCleaners);
      this.initialiseEventStreamManager();
      return vacuumCleaners;
    } catch (err) {
      logger.error({ err }, "Fehler bei der Geraeteerkennung");
      return [];
    }
  }

  /**
   * Fügt ein Xiaomi-Gerät manuell per IP-Adresse und Token hinzu.
   * Das Gerät wird nur hinzugefügt, wenn die Verbindung über miio erfolgreich ist
   * und es sich um ein Staubsauger-Gerät handelt.
   */
  async addDeviceByIpAndToken(ipAddress: string, token: string): Promise<DeviceVacuumCleaner> {
    const trimmedIp = ipAddress?.trim();
    const trimmedToken = token?.trim();
    if (!trimmedIp || !trimmedToken) {
      throw new Error("IP-Adresse und Token sind erforderlich");
    }

    logger.info({ address: trimmedIp }, "Versuche Xiaomi-Geraet per IP und Token hinzuzufuegen");

    const miioDevice = await this.deviceController.connect(trimmedIp, trimmedToken);
    if (!miioDevice) {
      throw new Error("Verbindung zum Geraet fehlgeschlagen. Bitte pruefe IP-Adresse und Token.");
    }

    const model = (miioDevice as any).miioModel ?? (miioDevice as any).model ?? "";
    const rawId = (miioDevice as any).id ?? "";
    const did = typeof rawId === "string" ? rawId.replace(/^miio:/, "") : String(rawId);

    const isVacuum =
      typeof model === "string" &&
      (model.toLowerCase().includes("vacuum") || model.toLowerCase().includes("roborock"));

    if (!isVacuum) {
      await this.deviceController.destroy(trimmedIp, trimmedToken);
      throw new Error(
        `Das Geraet (Modell: ${model || "unbekannt"}) ist kein unterstuetztes Staubsauger-Modell. ` +
          "Nur Xiaomi/Roborock Staubsauger werden unterstuetzt."
      );
    }

    try {
      const deviceId = did ? `xiaomi-${did}` : `xiaomi-${trimmedIp.replace(/\./g, "-")}`;
      const deviceName = model || XIAOMICONFIG.defaultDeviceName;

      const vacuum = new XiaomiVacuumCleaner(
        deviceName,
        deviceId,
        trimmedIp,
        trimmedToken,
        model,
        did || undefined,
        this.deviceController
      );
      await vacuum.updateValues();
      this.deviceManager.saveDevice(vacuum);
      this.initialiseEventStreamManager();

      logger.info({ deviceId, address: trimmedIp }, "Xiaomi Staubsauger erfolgreich hinzugefuegt");
      return vacuum;
    } catch (err) {
      await this.deviceController.destroy(trimmedIp, trimmedToken);
      logger.error({ err, address: trimmedIp }, "Fehler beim Hinzufuegen des Xiaomi-Geraets");
      throw err;
    }
  }

  async setPower(deviceId: string, power: boolean): Promise<boolean> {
    logger.info({ deviceId, power }, "Setze Power-Zustand fuer Geraet");
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      await vacuum.setPower(power, true, true);
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Setzen des Power-Zustands");
      return false;
    }
  }

  async startCleaning(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Starte Reinigung");
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      await vacuum.startCleaning(true, true);
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Starten der Reinigung");
      return false;
    }
  }

  async stopCleaning(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Stoppe Reinigung");
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      await vacuum.stopCleaning(true, true);
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Stoppen der Reinigung");
      return false;
    }
  }

  async pauseCleaning(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Pausiere Reinigung");
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      await vacuum.pauseCleaning(true, true);
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Pausieren der Reinigung");
      return false;
    }
  }

  async resumeCleaning(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Setze Reinigung fort");
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      const mode = vacuum.deviceState.mode;
      if (mode === DEVICE_MODE.CLEANING_ROOM_PAUSED) {
        await vacuum.resumeCleaningRoom(true, true);
      } else if (mode === DEVICE_MODE.CLEANING_ZONED_PAUSED) {
        await vacuum.resumeCleaningZones(true, true);
      } else {
        await vacuum.resumeCleaning(true, true);
      }
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Fortsetzen der Reinigung");
      return false;
    }
  }

  /**
   * Reinigungsoptionen sofort am Gerät ausführen und persistieren (ohne Raumsegment starten).
   */
  async applyCleaningRoomOptions(deviceId: string, options: StartCleaningRoomOptions): Promise<boolean> {
    if (options == null || Object.keys(options).length === 0) return false;
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      await this.applyStartCleaningRoomOptionsToVacuum(vacuum, options);
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Anwenden der Reinigungsoptionen");
      return false;
    }
  }

  private async applyStartCleaningRoomOptionsToVacuum(vacuum: DeviceVacuumCleaner, options: StartCleaningRoomOptions): Promise<void> {
    const noTrigger = false;
    if (typeof options.repeatTimes === "number" && Number.isFinite(options.repeatTimes)) {
      const rt = Math.max(1, Math.min(3, Math.round(options.repeatTimes)));
      await vacuum.changeRepeatTimes(rt, true, noTrigger);
    }
    if (typeof options.vacuumIntensity === "number" && Number.isFinite(options.vacuumIntensity)) {
      await vacuum.setFanSpeed(options.vacuumIntensity, true, noTrigger);
    }
    const wiper = coerceWiperIntensity(options.wiperIntensity);
    if (wiper != null) {
      await vacuum.setWiperLevel(wiper, true, noTrigger);
    }
    if (typeof options.cleaningMode === "number" && Number.isFinite(options.cleaningMode)) {
      const m = Math.round(options.cleaningMode);
      if (m === 1 || m === 2 || m === 3) {
        await vacuum.setCleaningMode(m, true, noTrigger);
      }
    }
  }

  /**
   * Raumreinigung: `roomIds` typisch Staubsauger-Raum-IDs (Schlüssel von roomMapping);
   * Optionen werden am Gerät ausgeführt, in `deviceState` gesetzt und per saveDevice persistiert.
   */
  async startCleaningRoom(deviceId: string, roomIds: string[], options?: StartCleaningRoomOptions): Promise<boolean> {
    if (roomIds.length === 0) return false;
    logger.info({ deviceId, rooms: JSON.stringify(roomIds) }, "Starte Raumreinigung");
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      if (options != null) {
        await this.applyStartCleaningRoomOptionsToVacuum(vacuum, options);
      }
      await vacuum.startCleaningRoom(roomIds, true, true);
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Starten der Raumreinigung");
      return false;
    }
  }

  async dock(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Sende Staubsauger zur Docking-Station");
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      await vacuum.dock(true, true);
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Senden zur Docking-Station");
      return false;
    }
  }

  async findMe(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Find-Me / Akustisches Signal am Staubsauger");
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      await vacuum.findMe(true);
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler bei findMe");
      return false;
    }
  }

  /**
   * Reinigungsreihenfolge per {@link DeviceVacuumCleaner.setCleanSequence} setzen (MiIO + Persistenz).
   */
  async setCleanSequenceForDevice(deviceId: string, sequence: string[]): Promise<DeviceVacuumCleaner | null> {
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return null;
    try {
      await vacuum.setCleanSequence([...sequence], true, true);
      this.deviceManager.saveDevice(vacuum);
      return vacuum;
    } catch (err) {
      logger.error({ err, deviceId }, "setCleanSequenceForDevice fehlgeschlagen");
      throw err;
    }
  }

  async startWash(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Dock: Waschen starten");
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      await vacuum.startWash(true, true);
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler bei startWash");
      return false;
    }
  }

  async stopWash(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Dock: Waschen stoppen");
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      await vacuum.stopWash(true, true);
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler bei stopWash");
      return false;
    }
  }

  async startDustCollection(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Dock: Absaugen starten");
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      await vacuum.startDustCollection(true, true);
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler bei startDustCollection");
      return false;
    }
  }

  async stopDustCollection(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Dock: Absaugen stoppen");
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      await vacuum.stopDustCollection(true, true);
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler bei stopDustCollection");
      return false;
    }
  }

  async getRoomMapping(deviceId: string): Promise<{ roomId: number; segmentId: string; attribute: number }[]> {
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum || !(vacuum instanceof XiaomiVacuumCleaner)) return [];
    const entries = await (vacuum as XiaomiVacuumCleaner).getRoomMapping();
    return entries.map(([roomId, segmentId, attribute]) => ({ roomId, segmentId, attribute }));
  }

  async navigateToRoom(deviceId: string, roomId: number): Promise<{ status: string }> {
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum || !(vacuum instanceof XiaomiVacuumCleaner)) {
      return { status: "Geraet nicht gefunden" };
    }
    const result = await (vacuum as XiaomiVacuumCleaner).navigateToRoom(roomId);
    return { status: result };
  }

  private async getVacuumCleaner(deviceId: string): Promise<DeviceVacuumCleaner | null> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) {
      logger.warn({ deviceId }, "Geraet nicht gefunden");
      return null;
    }
    if (device instanceof DeviceVacuumCleaner) {
      return device;
    }
    return await this.toVacuumCleaner(device, deviceId);
  }

  private async toVacuumCleaner(device: Device, deviceId: string): Promise<DeviceVacuumCleaner | null> {
    const vacuum = new XiaomiVacuumCleaner();
    Object.assign(vacuum, device);
    vacuum.moduleId = this.getModuleId();
    if (!((vacuum as any).triggerListeners instanceof Map)) {
      (vacuum as any).triggerListeners = new Map();
    }
    if (typeof (vacuum as any).setXiaomiController === "function") {
      (vacuum as any).setXiaomiController(this.deviceController);
    }
    if (!(vacuum instanceof DeviceVacuumCleaner)) {
      logger.warn({ deviceId }, "Geraet ist kein Staubsauger");
      return null;
    }
    await vacuum.updateValues();
    return vacuum;
  }

  private async convertDiscoveredDeviceToVacuumCleaner(device: XiaomiDeviceDiscovered): Promise<XiaomiVacuumCleaner> {
    const deviceId = device.id;
    const deviceName = device.name ?? XIAOMICONFIG.defaultDeviceName;
    let address = device.address;
    if (!address) {
      logger.warn(
        { deviceId },
        "Keine gueltige Adresse fuer Gerät gefunden, verwende Fallback"
      );
      address = device.address ?? "unknown";
    }
    let vacuum = new XiaomiVacuumCleaner(
      deviceName,
      deviceId,
      address,
      device.token ?? "",
      device.model,
      device.did,
      this.deviceController
    );
    await vacuum.updateValues();
    return vacuum;
  }

  private async convertDiscoveredDevicesToVacuumCleaners(devices: XiaomiDeviceDiscovered[]): Promise<XiaomiVacuumCleaner[]> {
    const vacuumCleaners: XiaomiVacuumCleaner[] = [];
    for (const device of devices) {
      try {
        const vacuum = await this.convertDiscoveredDeviceToVacuumCleaner(device);
        vacuumCleaners.push(vacuum);
      } catch (err) {
        logger.error(
          { err, deviceId: device.id },
          "Fehler beim Initialisieren von Geraet"
        );
      }
    };
    return vacuumCleaners;
  }

  async convertDeviceFromDatabase(device: Device): Promise<Device | null> {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }

    const deviceType = device.type as DeviceType;
    let convertedDevice: Device | null = null;

    switch (deviceType) {
      case DeviceType.VACUUM:
        const xiaomiVacuumCleaner = new XiaomiVacuumCleaner();
        Object.assign(xiaomiVacuumCleaner, device);
        if (!((xiaomiVacuumCleaner as any).triggerListeners instanceof Map)) {
          (xiaomiVacuumCleaner as any).triggerListeners = new Map();
        }
        xiaomiVacuumCleaner.setXiaomiController(this.deviceController);
        await xiaomiVacuumCleaner.updateValues();
        convertedDevice = xiaomiVacuumCleaner;
        break;
    }

    return convertedDevice;
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.deviceManager.getDevicesForModule(this.getModuleId());
    for (const device of devices) {
      if (device instanceof XiaomiVacuumCleaner) {
        device.setXiaomiController(this.deviceController);
      }
    }
  }
}

