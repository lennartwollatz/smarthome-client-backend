import { logger } from "../../../../../logger.js";
import { DeviceLight } from "../../../../../model/devices/DeviceLight.js";
import { HueDeviceController } from "../hueDeviceController.js";

export class HueLight extends DeviceLight {
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

  async updateValues(): Promise<void> {
    if (!this.hueDeviceController) {
      logger.debug("initializeValues() uebersprungen fuer {} - hueDeviceController ist null", this.id);
      return;
    }
    // HueDeviceController in Node ist aktuell stubbed.
  }

  protected async executeSetOn() {
    if (!this.hueDeviceController || !this.id) {
      logger.warn("HueDeviceController ist null - kann Lampe nicht einschalten fuer {}", this.id);
      return;
    }
    try {
      await this.hueDeviceController.setOn(this.id, true);
      this.on = true;
    } catch (error) {
      logger.error({ error, deviceId: this.id }, "Fehler beim Einschalten des Hue Light");
      // Fehler wird geloggt, aber nicht weitergeworfen, um Server-Absturz zu vermeiden
    }
  }

  protected async executeSetOff() {
    if (!this.hueDeviceController || !this.id) {
      logger.warn("HueDeviceController ist null - kann Lampe nicht ausschalten fuer {}", this.id);
      return;
    }
    try {
      await this.hueDeviceController.setOn(this.id, false);
      this.on = false;
    } catch (error) {
      logger.error({ error, deviceId: this.id }, "Fehler beim Ausschalten des Hue Light");
      // Fehler wird geloggt, aber nicht weitergeworfen, um Server-Absturz zu vermeiden
    }
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

