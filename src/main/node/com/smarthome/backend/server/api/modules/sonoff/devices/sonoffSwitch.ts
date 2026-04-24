import { logger } from "../../../../../logger.js";
import { DeviceSwitch } from "../../../../../model/devices/DeviceSwitch.js";
import { SonoffDeviceController } from "../sonoffDeviceController.js";
import { SonoffLanEndDevice } from "./sonoffDevice.js";
import { normalizeSonoffSwitchLanPayload } from "./sonoffSwitchLanPayload.js";

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


  async updateValues(): Promise<void> {
    const status = await this.sonoffController?.getStatus(this);
    if (!status) {
      return;
    }
    this.updateValuesFromPayload(status as Record<string, unknown>, false);
  }

  async delete(): Promise<void> {
  }

  /**
   * Nur Payloads der Form
   * ``{ switches: [{ switch, outlet }, …], ssid, bssid }``
   * (bzw. gleiche Daten nach {@link normalizeSonoffSwitchLanPayload}).
   */
  updateValuesFromPayload(payload: Record<string, unknown>, trigger: boolean = false): void {
    const flat = normalizeSonoffSwitchLanPayload(payload);
    if (!flat) {
      return;
    }
    const list = flat.switches as Record<string, unknown>[];
    for (const switchConfig of list) {
      const outlet = switchConfig.outlet;
      const switchState = switchConfig.switch;
      if (outlet === undefined || switchState === undefined || !this.buttons[String(outlet)]) {
        continue;
      }
      if (switchState === "on") {
        if (super.getButton(String(outlet))?.on === false) {
          super.on(String(outlet), false, trigger);
        }
      } else {
        if (super.getButton(String(outlet))?.on === true) {
          super.off(String(outlet), false, trigger);
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
