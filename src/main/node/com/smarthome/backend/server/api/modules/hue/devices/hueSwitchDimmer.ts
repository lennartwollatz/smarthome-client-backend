import { logger } from "../../../../../logger.js";
import { DeviceSwitchDimmer } from "../../../../../model/devices/DeviceSwitchDimmer.js";
import { HueDeviceController } from "../hueDeviceController.js";

export class HueSwitchDimmer extends DeviceSwitchDimmer {
  private bridgeId?: string;
  private batteryRid?: string;
  private hueDeviceController?: HueDeviceController;

  constructor(
    name?: string,
    id?: string,
    bridgeId?: string,
    buttonRids?: string[],
    batteryRid?: string,
    hueDeviceController?: HueDeviceController
  ) {
    super();
    if (name) this.name = name;
    if (id) this.id = id;
    this.bridgeId = bridgeId;
    this.batteryRid = batteryRid;
    this.hueDeviceController = hueDeviceController;
    (buttonRids ?? []).forEach(rid => this.addButton(rid));
    this.moduleId = "hue";
    this.isConnected = true;
  }

  async updateValues(): Promise<void> {
    if (!this.hueDeviceController) {
      logger.debug(
        "updateValues() uebersprungen fuer {} - hueDeviceController ist null",
        this.id
      );
      return;
    }
    if (this.bridgeId && this.batteryRid) {
      // HueDeviceController in Node ist aktuell stubbed.
    } else {
      this.hasBattery = false;
    }
  }

  protected executeToggle(buttonId: string) {
    logger.debug("executeToggle fuer Button {} - wird ueber Event-Stream verarbeitet", buttonId);
  }

  protected executeDoublePress(buttonId: string) {
    logger.debug("executeDoublePress fuer Button {} - wird ueber Event-Stream verarbeitet", buttonId);
  }

  protected executeTriplePress(buttonId: string) {
    logger.debug("executeTriplePress fuer Button {} - wird ueber Event-Stream verarbeitet", buttonId);
  }

  protected executeSetBrightness(buttonId: string, brightness: number) {
    logger.debug(
      "executeSetBrightness fuer Button {} - wird ueber Event-Stream verarbeitet",
      buttonId,
      brightness
    );
  }

  getBridgeId() {
    return this.bridgeId;
  }

  setBridgeId(bridgeId: string) {
    this.bridgeId = bridgeId;
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

