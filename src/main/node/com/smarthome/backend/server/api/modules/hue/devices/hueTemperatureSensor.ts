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
    logger.info("Update die Werte fuer {} ", this.id);
    if (!this.hueDeviceController) {
      logger.warn(
        "HueDeviceController ist null - kann Temperaturwert nicht initialisieren fuer {}",
        this.id
      );
      return;
    }
    // HueDeviceController in Node ist aktuell stubbed.
  }

  protected executeSetTemperature(_temperature: number) {}

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

