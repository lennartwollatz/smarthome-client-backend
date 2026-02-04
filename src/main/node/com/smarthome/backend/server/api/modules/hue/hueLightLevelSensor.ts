import { logger } from "../../../../logger.js";
import { DeviceLightLevel } from "../../../../model/devices/DeviceLightLevel.js";
import { HueDeviceController } from "./hueDeviceController.js";

export class HueLightLevelSensor extends DeviceLightLevel {
  private bridgeId?: string;
  private hueResourceId?: string;
  private batteryRid?: string;
  private hueDeviceController?: HueDeviceController;

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
    logger.info("Update die Werte fuer {}", this.id);
    if (!this.hueDeviceController || !this.id) {
      logger.warn("HueDeviceController ist null - kann Helligkeitswert nicht initialisieren fuer {}", this.id);
      return;
    }
    // HueDeviceController in Node ist aktuell stubbed.
  }

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

  protected executeSetLightLevel(_lightLevel: number) {}
}

