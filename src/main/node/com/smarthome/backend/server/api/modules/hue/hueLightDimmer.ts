import { logger } from "../../../../logger.js";
import { DeviceLightDimmer } from "../../../../model/devices/DeviceLightDimmer.js";
import { HueDeviceController } from "./hueDeviceController.js";

export class HueLightDimmer extends DeviceLightDimmer {
  private bridgeId?: string;
  private hueResourceId?: string;
  private batteryRid?: string;
  private hueDeviceController?: HueDeviceController;

  constructor(
    name?: string,
    id?: string,
    bridgeId?: string,
    hueResourceId?: string,
    batteryRid?: string
  ) {
    super();
    if (name) this.name = name;
    if (id) this.id = id;
    this.bridgeId = bridgeId;
    this.hueResourceId = hueResourceId;
    this.batteryRid = batteryRid;
    this.moduleId = "hue";
    this.isConnected = true;
  }

  updateValues() {
    if (!this.hueDeviceController) {
      logger.debug(
        "initializeDimmerValues() uebersprungen fuer {} - hueDeviceController ist null",
        this.id
      );
      return;
    }
    // HueDeviceController in Node ist aktuell stubbed.
  }

  protected executeSetOn() {
    if (!this.hueDeviceController || !this.id) {
      logger.warn("HueDeviceController ist null - kann Lampe nicht einschalten fuer {}", this.id);
      return;
    }
    this.hueDeviceController.setOn(this.id, true);
    this.on = true;
  }

  protected executeSetOff() {
    if (!this.hueDeviceController || !this.id) {
      logger.warn("HueDeviceController ist null - kann Lampe nicht ausschalten fuer {}", this.id);
      return;
    }
    this.hueDeviceController.setOn(this.id, false);
    this.on = false;
  }

  protected executeSetBrightness(brightness: number) {
    if (!this.hueDeviceController || !this.id) {
      logger.warn("HueDeviceController ist null - kann Helligkeit nicht setzen fuer {}", this.id);
      return;
    }
    this.hueDeviceController.setBrightness(this.id, brightness);
    this.brightness = brightness;
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

