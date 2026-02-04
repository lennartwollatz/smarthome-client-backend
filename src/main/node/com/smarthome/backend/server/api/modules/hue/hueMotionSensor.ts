import { logger } from "../../../../logger.js";
import { DeviceMotion } from "../../../../model/devices/DeviceMotion.js";
import { HueDeviceController } from "./hueDeviceController.js";

export class HueMotionSensor extends DeviceMotion {
  protected bridgeId?: string;
  protected hueResourceId?: string;
  protected batteryRid?: string;
  protected hueDeviceController?: HueDeviceController;

  constructor(
    name?: string,
    id?: string,
    bridgeId?: string,
    hueResourceId?: string,
    batteryRid?: string,
    hueDeviceController?: HueDeviceController
  ) {
    super();
    if (name) this.name = name;
    if (id) this.id = id;
    this.bridgeId = bridgeId;
    this.hueResourceId = hueResourceId;
    this.batteryRid = batteryRid;
    this.hueDeviceController = hueDeviceController;
    this.moduleId = "hue";
    this.isConnected = true;
  }

  updateValues() {
    if (!this.hueDeviceController) {
      logger.debug(
        "updateValues() uebersprungen fuer {} - hueDeviceController ist null",
        this.id
      );
      return;
    }
    // HueDeviceController in Node ist aktuell stubbed.
  }

  protected executeSetSensibility(sensitivity: number) {
    if (!this.hueDeviceController || !this.id) {
      logger.warn("HueDeviceController ist null - kann Empfindlichkeit nicht setzen fuer {}", this.id);
      return;
    }
    this.hueDeviceController.setSensitivity(this.id, sensitivity);
  }

  protected executeSetMotion(_motion: boolean, _motion_last_detect: string) {}

  getBridgeId() {
    return this.bridgeId;
  }

  setBridgeId(bridgeId: string) {
    this.bridgeId = bridgeId;
  }

  getHueResourceId() {
    return this.hueResourceId;
  }

  setHueResourceId(hueResourceId: string) {
    this.hueResourceId = hueResourceId;
  }

  getBatteryRid() {
    return this.batteryRid;
  }

  setBatteryRid(batteryRid: string) {
    this.batteryRid = batteryRid;
  }

  setHueDeviceController(hueDeviceController: HueDeviceController) {
    this.hueDeviceController = hueDeviceController;
  }
}

