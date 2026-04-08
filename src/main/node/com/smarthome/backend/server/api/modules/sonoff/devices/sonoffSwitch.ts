import { logger } from "../../../../../logger.js";
import { DeviceSwitch } from "../../../../../model/devices/DeviceSwitch.js";
import { SonoffDeviceController } from "../sonoffDeviceController.js";
import { SonoffLanEndDevice } from "./sonoffDevice.js";

export class SonoffSwitch extends DeviceSwitch implements SonoffLanEndDevice {
  /** eWeLink deviceid */
  ewelinkDeviceId = "";
  lanAddress = "";
  lanPort = 8081;
  lanApiKey = "";

  private sonoffController?: SonoffDeviceController;

  constructor(name?: string, id?: string, ewelinkDeviceId?: string, buttonIds?: readonly string[]) {
    super({
      name,
      id,
      moduleId: "sonoff",
      isConnected: true,
      isPairingMode: false,
      quickAccess: false,
    });
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


  //{"ok":true,"switch":"on","switches":null,"basicInfo":{"fwVersion":"1.2.0","ssid":"Wollatz","bssid":"3C:A6:2F:03:B9:E9","rssi":-49,"staMac":"54:32:04:8B:6C:30","sledOnline":"on","swMode":2,"swCtrlReverse":"off","relaySeparation":0,"configure":[{"outlet":0,"enableDelay":0,"width":21000,"startup":"off"}],"pulses":[{"outlet":0,"pulse":"off","switch":"off","width":500}],"switches":[{"outlet":0,"switch":"on"}],"triggerType":8,"autoUpgrade":{"enable":false,"range":["02:00","04:00"]},"deviceid":"192.168.178.95"}}
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
      if ((payload.basicInfo as Record<string, unknown>)?.switches) {
        for (const switchConfig of ((payload.basicInfo as Record<string, unknown>)?.switches as Record<string, unknown>[])) {
          const outlet = switchConfig.outlet;
          const switchState = switchConfig.switch;
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
          }
        }
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
    logger.debug({ buttonId }, "Sonoff doublePress – optional ueber Events");
  }

  protected async executeTriplePress(buttonId: string): Promise<void> {
    logger.debug({ buttonId }, "Sonoff triplePress – optional ueber Events");
  }

  protected async executeSetIntensity(_buttonId: string, _intensity: number): Promise<void> {
    logger.debug("executeSetIntensity: fuer reine Schalter nicht unterstuetzt");
  }
}
