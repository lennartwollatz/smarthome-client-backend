import { logger } from "../../../../../logger.js";
import { DeviceLightLevelMotionTemperature } from "../../../../../model/devices/DeviceLightLevelMotionTemperature.js";
import { HueDeviceController, rawSensitivityToPercent } from "../hueDeviceController.js";

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
    if (!this.hueDeviceController || !this.bridgeId || !this.motionRid) {
      logger.warn("HueDeviceController ist null - kann Werte nicht initialisieren fuer {}", this.id);
      return;
    }
    const status = await this.hueDeviceController.getMotion(this.bridgeId, this.motionRid);
    if (!status) return;
    if (status.sensitivity_max > 0) {
      this.max_sensitivity = status.sensitivity_max;
    }
    await this.setSensibility(
      rawSensitivityToPercent(status.sensitivity, status.sensitivity_max),
      false
    );
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

