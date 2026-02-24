import type { DatabaseManager } from "../../../db/database.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { logger } from "../../../../logger.js";
import { ModuleManager } from "../moduleManager.js";
import { XiaomiDeviceController } from "./xiaomiDeviceController.js";
import { XiaomiDeviceDiscovered } from "./xiaomiDeviceDiscovered.js";
import { XiaomiDeviceDiscover } from "./xiaomiDeviceDiscover.js";
import { DeviceVacuumCleaner } from "../../../../model/devices/DeviceVacuumCleaner.js";
import { XiaomiVacuumCleaner } from "./devices/xiaomiVacuumCleaner.js";
import { XiaomiEvent } from "./xiaomiEvent.js";
import { Device } from "../../../../model/index.js";
import { XiaomiEventStreamManager } from "./xiaomiEventStreamManager.js";
import { EventStreamManager } from "../../../events/eventStreamManager.js";
import { XIAOMICONFIG } from "./xiaomiModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";

export class XiaomiModuleManager extends ModuleManager<XiaomiEventStreamManager, XiaomiDeviceController, XiaomiDeviceController, XiaomiEvent, DeviceVacuumCleaner, XiaomiDeviceDiscover, XiaomiDeviceDiscovered> {

  constructor(
    databaseManager: DatabaseManager,
    actionManager: ActionManager,
    eventStreamManager: EventStreamManager
  ) {
    super(
      databaseManager, 
      actionManager, 
      eventStreamManager, 
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
    return new XiaomiEventStreamManager(this.getManagerId(), this.deviceController, this.actionManager);
  }

  async discoverDevices(): Promise<Device[]> {
    logger.info("Suche nach Xiaomi-Geraeten");
    try {
      const discoveredDevices = await this.deviceDiscover.discover(5, []);
      logger.info({ count: discoveredDevices.length }, "Geraete gefunden");

      // TODO: eventuell sollte die Konvertierung zu einem XiaomiVacuumCleaner und Speicherung
      // erst dann geschehen, wenn das Device übernommen wird.
      const vacuumCleaners = await this.convertDiscoveredDevicesToVacuumCleaners(discoveredDevices);
      this.actionManager.saveDevices(vacuumCleaners);
      this.initialiseEventStreamManager();
      return vacuumCleaners;
    } catch (err) {
      logger.error({ err }, "Fehler bei der Geraeteerkennung");
      return [];
    }
  }

  async setPower(deviceId: string, power: boolean): Promise<boolean> {
    logger.info({ deviceId, power }, "Setze Power-Zustand fuer Geraet");
    const vacuum = await this.getVacuumCleaner(deviceId);
    if (!vacuum) return false;
    try {
      vacuum.setPower(power, true);
      this.actionManager.saveDevice(vacuum);
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
      vacuum.startCleaning(true);
      this.actionManager.saveDevice(vacuum);
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
      vacuum.stopCleaning(true);
      this.actionManager.saveDevice(vacuum);
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
      vacuum.pauseCleaning(true);
      this.actionManager.saveDevice(vacuum);
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
      vacuum.resumeCleaning(true);
      this.actionManager.saveDevice(vacuum);
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
      vacuum.dock(true);
      this.actionManager.saveDevice(vacuum);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Senden zur Docking-Station");
      return false;
    }
  }

  private async getVacuumCleaner(deviceId: string): Promise<DeviceVacuumCleaner | null> {
    const device = this.actionManager.getDevice(deviceId);
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

  convertDeviceFromDatabase(device: Device): Device | null {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }

    const deviceType = device.type as DeviceType;
    let convertedDevice: Device | null = null;

    switch (deviceType) {
      case DeviceType.VACUUM:
        const xiaomiVacuumCleaner = new XiaomiVacuumCleaner();
        Object.assign(xiaomiVacuumCleaner, device);
        convertedDevice = xiaomiVacuumCleaner;
        break;
    }

    return convertedDevice;
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.actionManager.getDevicesForModule(this.getModuleId());
    for (const device of devices) {
      if (device instanceof XiaomiVacuumCleaner) {
        device.setXiaomiController(this.deviceController);
        await device.updateValues();
        this.actionManager.saveDevice(device);
      }
    }
  }
}

