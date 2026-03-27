import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { HueBridgeDiscover } from "./hueBridgeDiscover.js";
import { HueDeviceDiscover } from "./hueDeviceDiscover.js";
import { HueDeviceController } from "./hueDeviceController.js";
import { HueEventStreamManager } from "./hueEventStreamManager.js";
import { HueLight } from "./devices/hueLight.js";
import { HueLightDimmer } from "./devices/hueLightDimmer.js";
import { HueLightDimmerTemperatureColor } from "./devices/hueLightDimmerTemperatureColor.js";
import { HueLightDimmerTemperature } from "./devices/hueLightDimmerTemperature.js";
import { HueLightLevelSensor } from "./devices/hueLightLevelSensor.js";
import { HueTemperatureSensor } from "./devices/hueTemperatureSensor.js";
import { HueMotionSensor } from "./devices/hueMotionSensor.js";
import { HueLightLevelMotionTemperature } from "./devices/hueLightLevelMotionTemperature.js";
import { DeviceLight } from "../../../../model/devices/DeviceLight.js";
import { DeviceLightDimmer } from "../../../../model/devices/DeviceLightDimmer.js";
import { DeviceLightDimmerTemperature } from "../../../../model/devices/DeviceLightDimmerTemperature.js";
import { DeviceLightDimmerTemperatureColor } from "../../../../model/devices/DeviceLightDimmerTemperatureColor.js";
import { DeviceMotion } from "../../../../model/devices/DeviceMotion.js";
import { Device } from "../../../../model/devices/Device.js";
import { HueBridgeDiscovered } from "./hueBridgeDiscovered.js";
import { HueDeviceDiscovered } from "./hueDeviceDiscovered.js";
import { HueEvent } from "./hueEvent.js";
import { ModuleManagerBridged } from "../moduleManagerBridged.js";
import { HueBridgeController } from "./hueBridgeController.js";
import { EventManager } from "../../../events/EventManager.js";
import { HUECONFIG } from "./hueModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { HueSwitchDimmer } from "./devices/hueSwitchDimmer.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";

export class HueModuleManager extends ModuleManagerBridged<HueEventStreamManager, HueBridgeController, HueDeviceController, HueEvent, Device, HueDeviceDiscover, HueDeviceDiscovered, HueBridgeController, HueBridgeDiscover, HueBridgeDiscovered> {

  constructor(
    databaseManager: DatabaseManager,
    deviceManager: DeviceManager,
    eventManager: EventManager
  ) {
    const deviceController = new HueDeviceController(databaseManager);
    const bridgeController = new HueBridgeController(databaseManager);
    const bridgeDiscover = new HueBridgeDiscover(databaseManager);
    const deviceDiscover = new HueDeviceDiscover(databaseManager);
    
    super(
      databaseManager,
      deviceManager,
      eventManager,
      deviceController,
      deviceDiscover,
      bridgeController,
      bridgeDiscover
    );
  }

  public getModuleId(): string {
    return HUECONFIG.id;
  }
  protected getManagerId(): string {
    return HUECONFIG.managerId;
  }

  protected createEventStreamManager(): HueEventStreamManager {
    return new HueEventStreamManager(this.getManagerId(), this.bridgeController, this.deviceManager, this.databaseManager);
  }

  async getBridges() {
    return this.bridgeDiscover.getBridges()
      .filter(bridge => bridge.isPaired === true)
      .map(bridge => ({
      id: bridge.id,
      name: bridge.name,
      address: bridge.address,
      port: bridge.port,
      modelId: bridge.modelId,
      devices: bridge.devices,
      swVersion: bridge.swVersion,
      isPaired: bridge.isPaired,
    }));
  }

  async discoverBridges() {
    return this.bridgeDiscover.discover(10);
  }

  async pairBridge(bridgeId: string, _payload: Record<string, unknown>): Promise<boolean> {
    const bridge = this.bridgeDiscover.getBridge(bridgeId);
    if (!bridge) return false;
    const pairedBridge = await this.bridgeController.pairBridge(bridge);
    if (pairedBridge) {
       this.initialiseEventStreamManager();
       return true;
    }
    return false;
  }

  async discoverDevicesForBridge(bridgeId: string) {
    const devices = await this.deviceDiscover.discoverDevices(bridgeId);
    this.deviceManager.saveDevices(devices);
    return devices;
  }

  async setSensitivity(deviceId: string, sensitivity: number): Promise<boolean> {
    if (sensitivity < 0 || sensitivity > 100) return false;
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    if (!(device instanceof DeviceMotion)) return false;
    await device.setSensibility(sensitivity, true);
    return this.deviceManager.saveDevice(device);
  }

  async setOn(deviceId: string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    if (!(device instanceof DeviceLight)) return false;
    await device.setOn(true);
    return this.deviceManager.saveDevice(device);
  }

  async setOff(deviceId: string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    if (!(device instanceof DeviceLight)) return false;
    await device.setOff(true);
    return this.deviceManager.saveDevice(device);
  }

  async setBrightness(deviceId: string, brightness: number): Promise<boolean> {
    if (brightness < 0 || brightness > 100) return false;
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    if (!(device instanceof DeviceLightDimmer)) return false;
    await device.setBrightness(brightness, true);
    return this.deviceManager.saveDevice(device);
  }

  async setTemperature(deviceId: string, temperature: number): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    if (!(device instanceof DeviceLightDimmerTemperature)) return false;
    await device.setTemperature(temperature, true);
    return this.deviceManager.saveDevice(device);
  }

  async setColor(deviceId: string, x: number, y: number): Promise<boolean> {
    if (x < 0 || x > 1 || y < 0 || y > 1) return false;
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    if (!(device instanceof DeviceLightDimmerTemperatureColor)) return false;
    await device.setColor(x, y, true);
    return this.deviceManager.saveDevice(device);
  }

  async convertDeviceFromDatabase(device: Device): Promise<Device | null> {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }

    const deviceType = device.type as DeviceType;
    let convertedDevice: Device | null = null;

    switch (deviceType) {
      case DeviceType.LIGHT:
        const hueLight = new HueLight();
        Object.assign(hueLight, device);
        await hueLight.updateValues();
        convertedDevice = hueLight;
        break;
      case DeviceType.LIGHT_DIMMER:
        const hueLightDimmer = new HueLightDimmer();
        Object.assign(hueLightDimmer, device);
        await hueLightDimmer.updateValues();
        convertedDevice = hueLightDimmer;
        break;
      case DeviceType.LIGHT_DIMMER_TEMPERATURE:
        const hueLightDimmerTemperature = new HueLightDimmerTemperature();
        Object.assign(hueLightDimmerTemperature, device);
        await hueLightDimmerTemperature.updateValues();
        convertedDevice = hueLightDimmerTemperature;
        break;
      case DeviceType.LIGHT_DIMMER_TEMPERATURE_COLOR:
        const hueLightDimmerTemperatureColor = new HueLightDimmerTemperatureColor();
        Object.assign(hueLightDimmerTemperatureColor, device);
        await hueLightDimmerTemperatureColor.updateValues();
        convertedDevice = hueLightDimmerTemperatureColor;
        break;
      case DeviceType.MOTION:
        const hueMotionSensor = new HueMotionSensor();
        Object.assign(hueMotionSensor, device);
        await hueMotionSensor.updateValues();
        convertedDevice = hueMotionSensor;
        break;
      case DeviceType.TEMPERATURE:
        const hueTemperatureSensor = new HueTemperatureSensor();
        Object.assign(hueTemperatureSensor, device);
        await hueTemperatureSensor.updateValues();
        convertedDevice = hueTemperatureSensor;
        break;
      case DeviceType.LIGHT_LEVEL:
        const hueLightLevelSensor = new HueLightLevelSensor();
        Object.assign(hueLightLevelSensor, device);
        await hueLightLevelSensor.updateValues();
        convertedDevice = hueLightLevelSensor;
        break;
      case DeviceType.MOTION_LIGHT_LEVEL_TEMPERATURE:
        const hueLightLevelMotionTemperature = new HueLightLevelMotionTemperature();
        Object.assign(hueLightLevelMotionTemperature, device);
        await hueLightLevelMotionTemperature.updateValues();
        convertedDevice = hueLightLevelMotionTemperature;
        break;
      case DeviceType.SWITCH_DIMMER:
        const hueSwitchDimmer = new HueSwitchDimmer();
        Object.assign(hueSwitchDimmer, device);
        await hueSwitchDimmer.updateValues();
        convertedDevice = hueSwitchDimmer;
        break;
    }

    return convertedDevice;
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.deviceManager.getDevicesForModule(this.getModuleId());
    
    for (const device of devices) {
        if (device instanceof HueLight || 
            device instanceof HueLightDimmer || 
            device instanceof HueLightDimmerTemperatureColor || 
            device instanceof HueLightDimmerTemperature || 
            device instanceof HueLightLevelSensor || 
            device instanceof HueTemperatureSensor || 
            device instanceof HueMotionSensor ||
            device instanceof HueSwitchDimmer) {
          device.setHueDeviceController(this.deviceController);
      }
    }
  }
}

