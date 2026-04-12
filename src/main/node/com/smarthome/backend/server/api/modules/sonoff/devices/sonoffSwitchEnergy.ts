import { logger } from "../../../../../logger.js";
import { DeviceSwitchEnergy } from "../../../../../model/devices/DeviceSwitchEnergy.js";
import { SonoffDeviceController } from "../sonoffDeviceController.js";
import { SonoffLanEndDevice } from "./sonoffDevice.js";

export class SonoffSwitchEnergy extends DeviceSwitchEnergy implements SonoffLanEndDevice {
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

  //{"ok":true,"switch":"on","switches":[{"switch":"on","outlet":0},{"switch":"on","outlet":1}],"basicInfo":{"current_01":54,"voltage_01":23367,"actPow_01":8880,"reactPow_01":9193,"apparentPow_01":12781,"ssid":"Wollatz","bssid":"3C:A6:2F:03:B9:E9","deviceid":"192.168.178.171","switches":[{"switch":"on","outlet":0},{"switch":"on","outlet":1}]},"zeroconfSwitches":{"ok":true,"httpStatus":200,"data":{"workMode":1,"swMode_00":2,"swMode_01":2,"swReverse_00":0,"swReverse_01":0,"switches":[{"switch":"on","outlet":0},{"switch":"on","outlet":1}],"configure":[{"startup":"on","outlet":0},{"startup":"on","outlet":1}],"pulses":[{"pulse":"off","width":1000,"outlet":0},{"pulse":"off","width":1000,"outlet":1}],"overload_00":{"minActPow":{"enabled":0,"value":10},"maxVoltage":{"enabled":0,"value":24000},"minVoltage":{"enabled":0,"value":10},"maxCurrent":{"enabled":0,"value":1500},"maxActPow":{"enabled":0,"value":360000}},"overload_01":{"minActPow":{"enabled":0,"value":10},"maxVoltage":{"enabled":0,"value":24000},"minVoltage":{"enabled":0,"value":10},"maxCurrent":{"enabled":0,"value":1500},"maxActPow":{"enabled":0,"value":360000}},"sledBright":100,"staMac":"2043A8C2AB4C","rssi":-73,"oneKwhData_00":0,"oneKwhData_01":0},"endpoint":"getState","tried":["getState"]}}
  async updateValues(): Promise<void> {
    const status = await this.sonoffController?.getStatus(this);
    if (status?.ok === true) {
      await this.updateValuesFromPayload(status, false);

      //{"ok":true,"httpStatus":200,"data":{"current_00":2,"voltage_00":23616,"actPow_00":537,"reactPow_00":385,"apparentPow_00":661,"current_01":56,"voltage_01":23616,"actPow_01":9483,"reactPow_01":9288,"apparentPow_01":13274}}
      const stats = (status as Record<string, unknown>).statistics as
        | Record<string, unknown>
        | undefined;
      if (stats?.ok === true) {
        await this.updateStatisticsFromPayload(stats, false);
      }
    }
  }

  async delete(): Promise<void> {
  }

  async updateValuesFromPayload(payload: Record<string, unknown>, trigger: boolean = false): Promise<void> {
    if (payload?.ok !== true) {
      return;
    }
    const bi = payload.basicInfo as Record<string, unknown> | undefined;
    const zc = payload.zeroconfSwitches as Record<string, unknown> | undefined;
    const zcData =
      zc?.ok === true && typeof zc.data === "object" && zc.data !== null
        ? (zc.data as Record<string, unknown>)
        : undefined;

    let switchesList: Record<string, unknown>[] | null =
      Array.isArray(payload.switches) && (payload.switches as unknown[]).length > 0
        ? (payload.switches as Record<string, unknown>[])
        : null;
    if (!switchesList?.length && Array.isArray(bi?.switches) && (bi!.switches as unknown[]).length > 0) {
      switchesList = bi!.switches as Record<string, unknown>[];
    }
    if (!switchesList?.length && Array.isArray(zcData?.switches) && (zcData!.switches as unknown[]).length > 0) {
      switchesList = zcData!.switches as Record<string, unknown>[];
    }

    if (switchesList && switchesList.length > 0) {
      for (const switchConfig of switchesList) {
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
      return;
    }

    const buttonIds = Object.keys(this.buttons);
    if (buttonIds.length === 1 && typeof payload.switch === "string") {
      const only = buttonIds[0];
      if (this.buttons[only]) {
        if (payload.switch === "on") {
          if (super.getButton(only)?.on === false) {
            super.on(only, false, trigger);
          }
        } else {
          if (super.getButton(only)?.on === true) {
            super.off(only, false, trigger);
          }
        }
      }
      return;
    }

    const stats = payload.statistics as Record<string, unknown> | undefined;
    const data =
      stats?.ok === true && typeof stats.data === "object" && stats.data !== null
        ? (stats.data as Record<string, unknown>)
        : undefined;
    if (!data || buttonIds.length < 2) {
      return;
    }
    const threshold = 100;
    for (const bid of buttonIds) {
      const raw = data[`actPow_0${bid}`];
      if (raw === undefined || raw === null) {
        continue;
      }
      const on = Number(raw) >= threshold;
      if (!this.buttons[bid]) {
        continue;
      }
      if (on) {
        if (super.getButton(bid)?.on === false) {
          super.on(bid, false, trigger);
        }
      } else {
        if (super.getButton(bid)?.on === true) {
          super.off(bid, false, trigger);
        }
      }
    }
  }

  async updateStatisticsFromPayload(payload: Record<string, unknown>, trigger: boolean = false): Promise<void> {
    const buttons = Object.keys(this.buttons);
    if (payload?.ok !== true) {
      return;
    }
    const data = payload.data as Record<string, unknown> | undefined;
    if (!data || typeof data !== "object") {
      return;
    }
    for (const button of buttons) {
      const actPow = data[`actPow_0${button}`];
      if (actPow === undefined || actPow === null) {
        continue;
      }
      const watts = Number(actPow) / 100;
      if (Number.isNaN(watts)) {
        continue;
      }
      await this.setEnergyUsage(button, watts, false, trigger);
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
    logger.debug({ buttonId }, "Sonoff Energy doublePress");
  }

  protected async executeTriplePress(buttonId: string): Promise<void> {
    logger.debug({ buttonId }, "Sonoff Energy triplePress");
  }

  protected async executeSetIntensity(buttonId: string, intensity: number): Promise<void> {
    logger.debug({ buttonId, intensity }, "Sonoff Energy: keine Dimmung");
  }

}
