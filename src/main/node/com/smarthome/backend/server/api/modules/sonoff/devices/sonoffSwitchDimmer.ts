import { logger } from "../../../../../logger.js";
import { DeviceSwitchDimmer } from "../../../../../model/devices/DeviceSwitchDimmer.js";
import { SonoffDeviceController } from "../sonoffDeviceController.js";
import { SonoffLanEndDevice } from "./sonoffDevice.js";

export class SonoffSwitchDimmer extends DeviceSwitchDimmer implements SonoffLanEndDevice {
  ewelinkDeviceId = "";
  lanAddress = "";
  lanPort = 8081;
  lanApiKey = "";

  private sonoffController?: SonoffDeviceController;

  constructor(name?: string, id?: string, ewelinkDeviceId?: string, buttonIds?: string[]) {
    super({ name, id, moduleId: "sonoff", isConnected: true });
    if (ewelinkDeviceId) this.ewelinkDeviceId = ewelinkDeviceId;
    (buttonIds ?? []).forEach(buttonId => this.addButton(buttonId));
  }

  setSonoffController(controller?: SonoffDeviceController) {
    this.sonoffController = controller;
  }

  getEwelinkDeviceId(): string {
    return this.ewelinkDeviceId;
  }

  getLanAddress(): string {
    return this.lanAddress;
  }

  getLanPort(): number {
    return this.lanPort;
  }

  getLanApiKey(): string {
    return this.lanApiKey;
  }

  async updateValues(): Promise<void> {
    const status = await this.sonoffController?.getStatus(this);
    if(status) {
      this.updateValuesFromPayload(status, false);
    }
  }

  async delete(): Promise<void> {
  }

  updateValuesFromPayload(payload: Record<string, unknown>, trigger: boolean = false): void {
    if (payload?.ok !== true) {
      return;
    }
    const outlet = "0";
    const bi = payload.basicInfo as Record<string, unknown> | undefined;
    if (!bi || !this.buttons[outlet]) {
      return;
    }

    const switchState = bi.switch;
    const brightness = bi.brightness;
    const power = bi.power;

    if (switchState === "on") {
      if (super.getButton(outlet)?.on === false) {
        super.on(outlet, false, trigger);
      }
    } else if (switchState === "off") {
      if (super.getButton(outlet)?.on === true) {
        super.off(outlet, false, trigger);
      }
    }

    if (brightness !== undefined && brightness !== null) {
      const b = Number(brightness);
      if (!Number.isNaN(b) && super.getButton(outlet)?.brightness !== b) {
        super.setBrightness(outlet, b, false, trigger);
      }
    }

    if (power !== undefined && power !== null) {
      const p = Number(power);
      if (!Number.isNaN(p)) {
        super.setEnergyUsage(outlet, p / 100, false, trigger);
      }
    }
  }

  protected async executeToggle(buttonId: string): Promise<void> {
    await this.sonoffController?.toggleSwitch(this, buttonId);
  }

  protected async executeSetOn(buttonId: string): Promise<void> {
    await this.sonoffController?.setOn(this, buttonId);
  }

  protected async executeSetOff(buttonId: string): Promise<void> {
    await this.sonoffController?.setOff(this, buttonId);
  }

  protected async executeDoublePress(buttonId: string): Promise<void> {
    logger.debug({ buttonId }, "Sonoff Dimmer doublePress");
  }

  protected async executeTriplePress(buttonId: string): Promise<void> {
    logger.debug({ buttonId }, "Sonoff Dimmer triplePress");
  }

  protected async executeSetBrightness(buttonId: string, brightness: number): Promise<void> {
    await this.sonoffController?.setIntensity(this, buttonId, brightness);
  }
}
