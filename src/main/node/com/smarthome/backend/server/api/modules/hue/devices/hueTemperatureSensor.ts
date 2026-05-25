import { logger } from "../../../../../logger.js";
import { DeviceTemperature } from "../../../../../model/devices/DeviceTemperature.js";
import { HueDeviceController } from "../hueDeviceController.js";

export class HueTemperatureSensor extends DeviceTemperature {
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

  async updateValues(): Promise<void> {
    if (!this.hueDeviceController || !this.bridgeId || !this.hueResourceId) {
      logger.debug(
        { deviceId: this.id, hasController: !!this.hueDeviceController, bridgeId: this.bridgeId, hueResourceId: this.hueResourceId },
        "HueTemperatureSensor.updateValues uebersprungen"
      );
      return;
    }
    const status = await this.hueDeviceController.getTemperature(this.bridgeId, this.hueResourceId);
    if (!status || typeof status.temperature !== "number") return;
    const rounded = Math.round(status.temperature);
    if (this.temperature !== rounded) {
      await this.setTemperature(rounded, false);
    }
  }

  protected async executeSetTemperature(temperature: number): Promise<void> {
    return;
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
}

