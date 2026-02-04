import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import type { EventStreamManager } from "../../../events/eventStreamManager.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { HueDiscover } from "./hueDiscover.js";
import { HueBridgeController } from "./hueBridgeController.js";
import { HueDeviceController } from "./hueDeviceController.js";
import { HueModuleEventStreamManager } from "./hueModuleEventStreamManager.js";
import { HueLight } from "./hueLight.js";
import { HueLightDimmer } from "./hueLightDimmer.js";
import { HueLightDimmerTemperatureColor } from "./hueLightDimmerTemperatureColor.js";
import { HueLightDimmerTemperature } from "./hueLightDimmerTemperature.js";
import { HueLightLevelSensor } from "./hueLightLevelSensor.js";
import { HueTemperatureSensor } from "./hueTemperatureSensor.js";
import { HueMotionSensor } from "./hueMotionSensor.js";
import { DeviceLight } from "../../../../model/devices/DeviceLight.js";
import { DeviceLightDimmer } from "../../../../model/devices/DeviceLightDimmer.js";
import { DeviceLightDimmerTemperature } from "../../../../model/devices/DeviceLightDimmerTemperature.js";
import { DeviceLightDimmerTemperatureColor } from "../../../../model/devices/DeviceLightDimmerTemperatureColor.js";
import { DeviceMotion } from "../../../../model/devices/DeviceMotion.js";

export class HueModuleManager {
  private hueDiscover: HueDiscover;
  private hueBridgeController: HueBridgeController;
  private hueDeviceController: HueDeviceController;
  private actionManager: ActionManager;
  private eventStreamManager: EventStreamManager;
  private databaseManager: DatabaseManager;

  constructor(
    databaseManager: DatabaseManager,
    eventStreamManager: EventStreamManager,
    actionManager: ActionManager
  ) {
    this.actionManager = actionManager;
    this.eventStreamManager = eventStreamManager;
    this.databaseManager = databaseManager;
    this.hueDiscover = new HueDiscover(databaseManager);
    this.hueBridgeController = new HueBridgeController(databaseManager);
    this.hueDeviceController = new HueDeviceController(databaseManager);
    this.setHueDeviceController();
    this.registerEventStreamManagers();
  }

  setHueDeviceController() {
    const devices = this.actionManager.getDevices();
    devices.forEach(device => this.setHueDeviceControllerForDevice(device));
  }

  setHueDeviceControllerForDevice(device: unknown) {
    if (device instanceof HueLight) {
      device.setHueDeviceController(this.hueDeviceController);
    } else if (device instanceof HueLightDimmer) {
      device.setHueDeviceController(this.hueDeviceController);
    } else if (device instanceof HueLightDimmerTemperatureColor) {
      device.setHueDeviceController(this.hueDeviceController);
    } else if (device instanceof HueLightDimmerTemperature) {
      device.setHueDeviceController(this.hueDeviceController);
    } else if (device instanceof HueLightLevelSensor) {
      device.setHueDeviceController(this.hueDeviceController);
    } else if (device instanceof HueTemperatureSensor) {
      device.setHueDeviceController(this.hueDeviceController);
    } else if (device instanceof HueMotionSensor) {
      device.setHueDeviceController(this.hueDeviceController);
    }
  }

  private registerEventStreamManagers() {
    try {
      const managers = this.hueBridgeController.createEventStreamManagers(this.actionManager);
      if (managers.length) {
        this.eventStreamManager.registerModuleEventStreamManager(managers);
      }
    } catch (err) {
      logger.warn({ err }, "EventStreamManager konnten nicht initialisiert werden");
    }
  }

  async discoverBridges() {
    return this.hueDiscover.discoverBridges();
  }

  async pairBridge(bridgeId: string, _payload: Record<string, unknown>) {
    const success = await this.hueBridgeController.pairBridge(bridgeId);
    if (success) {
      try {
        const manager = new HueModuleEventStreamManager(bridgeId, this.actionManager, this.databaseManager);
        this.eventStreamManager.registerModuleEventStreamManager(manager);
      } catch (err) {
        logger.warn({ err }, "EventStreamManager fuer Bridge {} konnte nicht registriert werden", bridgeId);
      }
    }
    return success;
  }

  async discoverDevices(bridgeId: string) {
    return this.hueDiscover.discoverDevices(bridgeId);
  }

  setSensitivity(deviceId: string, sensitivity: number) {
    if (sensitivity < 0 || sensitivity > 100) return false;
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return false;
    if (!(device instanceof DeviceMotion)) return false;
    device.setSensibility(sensitivity, true);
    return this.actionManager.saveDevice(device);
  }

  setOn(deviceId: string) {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return false;
    if (!(device instanceof DeviceLight)) return false;
    device.setOn(true);
    return this.actionManager.saveDevice(device);
  }

  setOff(deviceId: string) {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return false;
    if (!(device instanceof DeviceLight)) return false;
    device.setOff(true);
    return this.actionManager.saveDevice(device);
  }

  setBrightness(deviceId: string, brightness: number) {
    if (brightness < 0 || brightness > 100) return false;
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return false;
    if (!(device instanceof DeviceLightDimmer)) return false;
    device.setBrightness(brightness, true);
    return this.actionManager.saveDevice(device);
  }

  setTemperature(deviceId: string, temperature: number) {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return false;
    if (!(device instanceof DeviceLightDimmerTemperature)) return false;
    device.setTemperature(temperature, true);
    return this.actionManager.saveDevice(device);
  }

  setColor(deviceId: string, x: number, y: number) {
    if (x < 0 || x > 1 || y < 0 || y > 1) return false;
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return false;
    if (!(device instanceof DeviceLightDimmerTemperatureColor)) return false;
    device.setColor(x, y, true);
    return this.actionManager.saveDevice(device);
  }
}

