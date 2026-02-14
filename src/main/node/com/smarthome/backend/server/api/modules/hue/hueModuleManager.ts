import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import type { ActionManager } from "../../../actions/actionManager.js";
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
import { EventStreamManager } from "../../../events/eventStreamManager.js";
import { HUECONFIG } from "./hueModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { HueCameraMotionSensor } from "./devices/hueCameraMotionSensor.js";
import { HueSwitchDimmer } from "./devices/hueSwitchDimmer.js";

export class HueModuleManager extends ModuleManagerBridged<HueEventStreamManager, HueBridgeController, HueDeviceController, HueEvent, Device, HueDeviceDiscover, HueDeviceDiscovered, HueBridgeController, HueBridgeDiscover, HueBridgeDiscovered> {

  constructor(
    databaseManager: DatabaseManager,
    actionManager: ActionManager,
    eventStreamManager: EventStreamManager
  ) {
    const deviceController = new HueDeviceController(databaseManager);
    const bridgeController = new HueBridgeController(databaseManager);
    const bridgeDiscover = new HueBridgeDiscover(databaseManager);
    const deviceDiscover = new HueDeviceDiscover(databaseManager);
    
    super(
      databaseManager,
      actionManager,
      eventStreamManager,
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
    return new HueEventStreamManager(this.getManagerId(), this.bridgeController, this.actionManager, this.databaseManager);
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
    return this.deviceDiscover.discoverDevices(bridgeId);
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

  public convertDeviceFromDatabase(device: Device): Device | null {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }

    const deviceType = device.type as DeviceType;
    let convertedDevice: Device | null = null;

    switch (deviceType) {
      case DeviceType.LIGHT:
        const hueLight = new HueLight();
        Object.assign(hueLight, device);
        convertedDevice = hueLight;
        break;
      case DeviceType.LIGHT_DIMMER:
        const hueLightDimmer = new HueLightDimmer();
        Object.assign(hueLightDimmer, device);
        convertedDevice = hueLightDimmer;
        break;
      case DeviceType.LIGHT_DIMMER_TEMPERATURE:
        const hueLightDimmerTemperature = new HueLightDimmerTemperature();
        Object.assign(hueLightDimmerTemperature, device);
        convertedDevice = hueLightDimmerTemperature;
        break;
      case DeviceType.LIGHT_DIMMER_TEMPERATURE_COLOR:
        const hueLightDimmerTemperatureColor = new HueLightDimmerTemperatureColor();
        Object.assign(hueLightDimmerTemperatureColor, device);
        convertedDevice = hueLightDimmerTemperatureColor;
        break;
      case DeviceType.MOTION:
        // Prüfe ob es ein Camera Motion Sensor ist (anhand des Icons)
        if (device.icon === "&#128249;") {
          const hueCameraMotionSensor = new HueCameraMotionSensor();
          Object.assign(hueCameraMotionSensor, device);
          convertedDevice = hueCameraMotionSensor;
        } else {
          const hueMotionSensor = new HueMotionSensor();
          Object.assign(hueMotionSensor, device);
          convertedDevice = hueMotionSensor;
        }
        break;
      case DeviceType.TEMPERATURE:
        const hueTemperatureSensor = new HueTemperatureSensor();
        Object.assign(hueTemperatureSensor, device);
        convertedDevice = hueTemperatureSensor;
        break;
      case DeviceType.LIGHT_LEVEL:
        const hueLightLevelSensor = new HueLightLevelSensor();
        Object.assign(hueLightLevelSensor, device);
        convertedDevice = hueLightLevelSensor;
        break;
      case DeviceType.MOTION_LIGHT_LEVEL_TEMPERATURE:
        const hueLightLevelMotionTemperature = new HueLightLevelMotionTemperature();
        Object.assign(hueLightLevelMotionTemperature, device);
        convertedDevice = hueLightLevelMotionTemperature;
        break;
      case DeviceType.SWITCH_DIMMER:
        const hueSwitchDimmer = new HueSwitchDimmer();
        Object.assign(hueSwitchDimmer, device);
        convertedDevice = hueSwitchDimmer;
        break;
    }

    return convertedDevice;
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.actionManager.getDevicesForModule(this.getModuleId());
    const updatePromises: Promise<void>[] = [];
    
    devices.forEach(device => {
        if (device instanceof HueLight || 
            device instanceof HueLightDimmer || 
            device instanceof HueLightDimmerTemperatureColor || 
            device instanceof HueLightDimmerTemperature || 
            device instanceof HueLightLevelSensor || 
            device instanceof HueTemperatureSensor || 
            device instanceof HueMotionSensor ||
            device instanceof HueSwitchDimmer) {
          device.setHueDeviceController(this.deviceController);
          // Rufe updateValues() für jedes Device auf
          updatePromises.push(
            device.updateValues().then(() => {
              this.actionManager.saveDevice(device);
            }).catch(err => {
              logger.error({ err, deviceId: device.id }, "Fehler beim updateValues nach Controller-Initialisierung");
            })
          );
      }
    });
    
    // Warte auf alle updateValues()-Aufrufe
    await Promise.all(updatePromises);
  }
}

