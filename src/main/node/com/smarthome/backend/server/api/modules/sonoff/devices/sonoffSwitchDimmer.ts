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
    if (payload?.ok === true) {
      const outlet = "0";
      const switchState = (payload.basicInfo as Record<string, unknown>).switch;
      const brightness = (payload.basicInfo as Record<string, unknown>).brightness;
      const power = (payload.basicInfo as Record<string, unknown>).power;

      if(this.buttons[String(outlet)]) {
        if(switchState === "on") { 
          if( super.getButton(String(outlet))?.on === false) {
            super.on(String(outlet), false, trigger);
          }
        } else {
          if( super.getButton(String(outlet))?.on === true) {
            super.off(String(outlet), false, trigger);
          }
        }

        if( super.getButton(String(outlet))?.brightness !== Number(brightness)) {
          super.setBrightness(String(outlet), Number(brightness), false, trigger);
        }

        super.setEnergyUsage(String(outlet), Number(power) / 100, false, trigger);
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
