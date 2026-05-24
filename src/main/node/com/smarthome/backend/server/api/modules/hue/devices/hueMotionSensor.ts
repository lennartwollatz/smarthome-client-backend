import { logger } from "../../../../../logger.js";
import { DeviceMotion } from "../../../../../model/devices/DeviceMotion.js";
import { HueDeviceController, rawSensitivityToPercent } from "../hueDeviceController.js";

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

  async updateValues(): Promise<void> {
    if (!this.hueDeviceController || !this.bridgeId || !this.hueResourceId) {
      logger.debug(
        "updateValues() uebersprungen fuer {} - hueDeviceController ist null",
        this.id
      );
      return;
    }
    const status = await this.hueDeviceController.getMotion(this.bridgeId, this.hueResourceId);
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
    if (!this.hueDeviceController || !this.id) {
      logger.warn("HueDeviceController ist null - kann Empfindlichkeit nicht setzen fuer {}", this.id);
      return;
    }
    this.hueDeviceController.setSensitivity(this.id, sensitivity);
  }

  protected async executeSetMotion(_motion: boolean, _motion_last_detect: string): Promise<void> {}

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

