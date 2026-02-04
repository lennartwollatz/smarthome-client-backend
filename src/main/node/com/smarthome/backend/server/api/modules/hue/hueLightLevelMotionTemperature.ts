import { logger } from "../../../../logger.js";
import { DeviceLightLevelMotionTemperature } from "../../../../model/devices/DeviceLightLevelMotionTemperature.js";
import { HueDeviceController } from "./hueDeviceController.js";

export class HueLightLevelMotionTemperature extends DeviceLightLevelMotionTemperature {
  protected bridgeId?: string;
  protected motionRid?: string;
  protected lightLevelRid?: string;
  protected temperatureRid?: string;
  protected batteryRid?: string;
  protected hueDeviceController?: HueDeviceController;

  constructor(
    name?: string,
    id?: string,
    bridgeId?: string,
    motionRid?: string,
    lightLevelRid?: string,
    temperatureRid?: string,
    batteryRid?: string,
    hueDeviceController?: HueDeviceController
  ) {
    super();
    if (name) this.name = name;
    if (id) this.id = id;
    this.bridgeId = bridgeId;
    this.motionRid = motionRid;
    this.lightLevelRid = lightLevelRid;
    this.temperatureRid = temperatureRid;
    this.batteryRid = batteryRid;
    this.hueDeviceController = hueDeviceController;
    this.moduleId = "hue";
    this.isConnected = true;
  }

  updateValues() {
    logger.info("Update die Werte fuer {}", this.id);
    if (!this.hueDeviceController || !this.id) {
      logger.warn("HueDeviceController ist null - kann Werte nicht initialisieren fuer {}", this.id);
      return;
    }
    // HueDeviceController in Node ist aktuell stubbed.
  }

  protected executeSetSensibility(sensitivity: number) {
    if (!this.hueDeviceController || !this.id || !this.motionRid) {
      logger.warn("HueDeviceController oder MotionRid ist null - kann Empfindlichkeit nicht setzen fuer {}", this.id);
      return;
    }
    this.hueDeviceController.setSensitivity(this.id, sensitivity);
  }

  protected executeSetMotion(_motion: boolean, _motion_last_detect: string) {
    // Motion wird von der Bridge automatisch aktualisiert
  }

  protected executeSetLightLevel(_lightLevel: number) {
    // Light Level wird von der Bridge automatisch aktualisiert
  }

  protected executeSetTemperature(_temperature: number) {
    // Temperature wird von der Bridge automatisch aktualisiert
  }

  getBridgeId() {
    return this.bridgeId;
  }

  setBridgeId(bridgeId: string) {
    this.bridgeId = bridgeId;
  }

  getMotionRid() {
    return this.motionRid;
  }

  setMotionRid(motionRid: string) {
    this.motionRid = motionRid;
  }

  getLightLevelRid() {
    return this.lightLevelRid;
  }

  setLightLevelRid(lightLevelRid: string) {
    this.lightLevelRid = lightLevelRid;
  }

  getTemperatureRid() {
    return this.temperatureRid;
  }

  setTemperatureRid(temperatureRid: string) {
    this.temperatureRid = temperatureRid;
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

