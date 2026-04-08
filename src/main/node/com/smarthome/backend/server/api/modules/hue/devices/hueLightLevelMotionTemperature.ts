import { logger } from "../../../../../logger.js";
import { DeviceLightLevelMotionTemperature } from "../../../../../model/devices/DeviceLightLevelMotionTemperature.js";
import { HueDeviceController } from "../hueDeviceController.js";

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

  async updateValues(): Promise<void> {
    logger.info("Update die Werte fuer {}", this.id);
    if (!this.hueDeviceController || !this.id) {
      logger.warn("HueDeviceController ist null - kann Werte nicht initialisieren fuer {}", this.id);
      return;
    }
    // HueDeviceController in Node ist aktuell stubbed.
  }

  protected async executeSetSensibility(sensitivity: number): Promise<void> {
    if (!this.hueDeviceController || !this.id || !this.motionRid) {
      logger.warn("HueDeviceController oder MotionRid ist null - kann Empfindlichkeit nicht setzen fuer {}", this.id);
      return;
    }
    await this.hueDeviceController.setSensitivity(this.id, sensitivity);
  }


  setHueDeviceController(hueDeviceController: HueDeviceController) {
    this.hueDeviceController = hueDeviceController;
  }
}

