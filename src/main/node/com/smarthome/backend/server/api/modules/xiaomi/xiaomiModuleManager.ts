import type { DatabaseManager } from "../../../db/database.js";
import { logger } from "../../../../logger.js";
import { ModuleManager } from "../moduleManager.js";
import { XiaomiDeviceController } from "./xiaomiDeviceController.js";
import { XiaomiDeviceDiscovered } from "./xiaomiDeviceDiscovered.js";
import { XiaomiDeviceDiscover } from "./xiaomiDeviceDiscover.js";
import { DeviceVacuumCleaner } from "../../../../model/devices/DeviceVacuumCleaner.js";
import { XiaomiVacuumCleaner } from "./devices/xiaomiVacuumCleaner.js";
import { XiaomiEvent } from "./xiaomiEvent.js";
import { Device } from "../../../../model/devices/Device.js";
import { XiaomiEventStreamManager } from "./xiaomiEventStreamManager.js";
import { EventManager } from "../../../events/EventManager.js";
import { XIAOMICONFIG } from "./xiaomiModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";

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

      // TODO: eventuell sollte die Konvertierung zu einem XiaomiVacuumCleaner und Speicherung
      // erst dann geschehen, wenn das Device übernommen wird.
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
      await vacuum.resumeCleaning(true, true);
      this.deviceManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Fortsetzen der Reinigung");
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

