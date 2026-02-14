import type { DatabaseManager } from "../../../db/database.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { logger } from "../../../../logger.js";
import { ModuleManager } from "../moduleManager.js";
import { WACLightingDeviceController } from "./waclightingDeviceController.js";
import { WACLightingDeviceDiscovered } from "./waclightingDeviceDiscovered.js";
import { WACLightingDeviceDiscover } from "./waclightingDeviceDiscover.js";
import { DeviceFanLight } from "../../../../model/devices/DeviceFanLight.js";
import { Device } from "../../../../model/devices/Device.js";
import { WACLightingEvent } from "./waclightingEvent.js";
import { WACLightingEventStreamManager } from "./waclightingEventStreamManager.js";
import { EventStreamManager } from "../../../events/eventStreamManager.js";
import { WACLIGHTINGCONFIG } from "./waclightingModule.js";
import { WACFanLight } from "./devices/wacFanLight.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";

// HeosModuleManager ist abstrakt und wird von konkreten Implementierungen wie DenonModuleManager erweitert
export abstract class WACLightingModuleManager extends ModuleManager<WACLightingEventStreamManager, WACLightingDeviceController, WACLightingDeviceController, WACLightingEvent, DeviceFanLight, WACLightingDeviceDiscover, WACLightingDeviceDiscovered> {

  constructor(
    databaseManager: DatabaseManager,
    actionManager: ActionManager,
    eventStreamManager: EventStreamManager,
    deviceDiscover: WACLightingDeviceDiscover
  ) {
    const controller = new WACLightingDeviceController();
    super(
      databaseManager,
      actionManager,
      eventStreamManager,
      controller,
      deviceDiscover
    );
  }

  public getModuleId(): string {
    return WACLIGHTINGCONFIG.id;
  }
  protected getManagerId(): string {
    return WACLIGHTINGCONFIG.managerId;
  }

  protected createEventStreamManager(): WACLightingEventStreamManager {
    return new WACLightingEventStreamManager(this.getManagerId(), this.getModuleId(), this.deviceController, this.actionManager);
  }

  async discoverDevices(): Promise<Device[]> {
    logger.info("Suche nach WAC LIGHTING-Geraeten");
    try {
      const searchDurationSek = 30;
      const wacLightingDevices = await this.deviceDiscover.discover(searchDurationSek);
      logger.info({ count: wacLightingDevices.length }, "Geraete gefunden");
      const fans = await this.convertDiscoveredDevicesToWACLightingDevices(wacLightingDevices);
      this.actionManager.saveDevices(fans);
      this.initialiseEventStreamManager();
      return fans;
    } catch (err) {
      logger.error({ err }, "Fehler bei der Geraeteerkennung WAC LIGHTING");
      return [];
    }
  }

  private async convertDiscoveredDeviceToWACFanLight(device: WACLightingDeviceDiscovered): Promise<WACFanLight> {
    const deviceId = device.id;
    const deviceName = device.name ?? WACLIGHTINGCONFIG.defaultDeviceName;
    const address = device.address;
    const port = device.port;

    const fanLight = new WACFanLight(deviceName, deviceId, address, port, this.deviceController);
    await fanLight.updateValues();
    return fanLight;
  }

  private async convertDiscoveredDevicesToWACLightingDevices(devices: WACLightingDeviceDiscovered[]): Promise<WACFanLight[]> {
    const fanLights: WACFanLight[] = [];
    for (const device of devices) {
      try {
        const fanLight = await this.convertDiscoveredDeviceToWACFanLight(device);
        fanLights.push(fanLight);
      } catch (err) {
        logger.error({ err, deviceId: device.id }, "Fehler beim Initialisieren von WAC Fan Light");
      }
    }
    return fanLights;
  }

  async setFanOn(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Schalte WAC Fan ein");
    const fanLight = await this.getFanLight(deviceId);
    if (!fanLight) return false;
    try {
      fanLight.setOn(true);
      this.actionManager.saveDevice(fanLight);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Einschalten des Fans");
      return false;
    }
  }

  async setFanOff(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Schalte WAC Fan aus");
    const fanLight = await this.getFanLight(deviceId);
    if (!fanLight) return false;
    try {
      fanLight.setOff(true);
      this.actionManager.saveDevice(fanLight);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Ausschalten des Fans");
      return false;
    }
  }

  async setFanSpeed(deviceId: string, speed: number): Promise<boolean> {
    logger.info({ deviceId, speed }, "Setze WAC Fan Geschwindigkeit");
    const fanLight = await this.getFanLight(deviceId);
    if (!fanLight) return false;
    try {
      fanLight.setSpeed(speed, true);
      this.actionManager.saveDevice(fanLight);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Setzen der Fan-Geschwindigkeit");
      return false;
    }
  }

  async setLightOn(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Schalte WAC Licht ein");
    const fanLight = await this.getFanLight(deviceId);
    if (!fanLight) return false;
    try {
      await fanLight.setLightOn(true);
      this.actionManager.saveDevice(fanLight);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Schalten des Lichts");
      return false;
    }
  }

  async setLightOff(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Schalte WAC Licht aus");
    const fanLight = await this.getFanLight(deviceId);
    if (!fanLight) return false;
    try {
      await fanLight.setLightOff(true);
      this.actionManager.saveDevice(fanLight);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Ausschalten des Lichts");
      return false;
    }
  }

  async setLightBrightness(deviceId: string, brightness: number): Promise<boolean> {
    logger.info({ deviceId, brightness }, "Setze WAC Licht Helligkeit");
    const fanLight = await this.getFanLight(deviceId);
    if (!fanLight) return false;
    try {
      fanLight.setLightBrightness(brightness, true);
      this.actionManager.saveDevice(fanLight);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Setzen der Licht-Helligkeit");
      return false;
    }
  }

  private async getFanLight(deviceId: string): Promise<WACFanLight | null> {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) {
      logger.warn({ deviceId }, "Geraet nicht gefunden");
      return null;
    }
    if (device instanceof WACFanLight) {
      return device;
    }
    return await this.toFanLight(device, deviceId);
  }

  private async toFanLight(device: Device, deviceId: string): Promise<WACFanLight | null> {
    const fanLight = new WACFanLight();
    Object.assign(fanLight, device);
    fanLight.moduleId = this.getModuleId();
    if (!((fanLight as any).triggerListeners instanceof Map)) {
      (fanLight as any).triggerListeners = new Map();
    }
    if (typeof (fanLight as any).setWACController === "function") {
      (fanLight as any).setWACController(this.deviceController);
    }
    if (!(fanLight instanceof WACFanLight)) {
      logger.warn({ deviceId }, "Geraet ist kein WAC Fan Light");
      return null;
    }
    await fanLight.updateValues();
    return fanLight;
  }

  convertDeviceFromDatabase(device: Device): Device | null {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }

    const deviceType = device.type as DeviceType;
    let convertedDevice: Device | null = null;

    switch (deviceType) {
      case DeviceType.FAN_LIGHT:
        const wacFanLight = new WACFanLight();
        Object.assign(wacFanLight, device);
        convertedDevice = wacFanLight;
        break;
    }

    return convertedDevice;
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.actionManager.getDevicesForModule(this.getModuleId());
    for (const device of devices) {
      if (device instanceof WACFanLight) {
        device.setWACController(this.deviceController);
        await device.updateValues();
        this.actionManager.saveDevice(device);
      }
    }
  }
}

