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
      if((status.statistics as Record<string, unknown>)?.ok === true){
        await this.updateStatisticsFromPayload(status.statistics as Record<string, unknown>, false);
      }
    }
  }

  async delete(): Promise<void> {
  }

  async updateValuesFromPayload(payload: Record<string, unknown>, trigger: boolean = false): Promise<void> {
    if (payload?.ok === true) {
      const buttons = [];
      if (payload?.switches) {
        for (const switchConfig of (payload?.switches as Record<string, unknown>[])) {
          const outlet = switchConfig.outlet;
          buttons.push(String(outlet));
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

  async updateStatisticsFromPayload(payload: Record<string, unknown>, trigger: boolean = false): Promise<void> {
    const buttons = Object.keys(this.buttons);
    //{"ok":true,"httpStatus":200,"data":{"current_00":2,"voltage_00":23616,"actPow_00":537,"reactPow_00":385,"apparentPow_00":661,"current_01":56,"voltage_01":23616,"actPow_01":9483,"reactPow_01":9288,"apparentPow_01":13274}}
    if(payload?.ok === true){
      const data = payload?.data as Record<string, unknown>;
      for (const button of buttons) {
        //const current = data[`current_0${button}`]; //Strom in Ampere (A) * 100
        //const voltage = data[`voltage_0${button}`]; //Spannung in Volt (V) * 100
        const actPow = data[`actPow_0${button}`]; //Echte Leistung in Watt (W) * 100 
        //const reactPow = data[`reactPow_0${button}`]; //Blindleistung in Watt (W) * 100
        //const apparentPow = data[`apparentPow_0${button}`]; //Scheinleistung in Watt (W) * 100 
        await this.setEnergyUsage(button, Number(actPow) / 100, false, trigger);
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
    logger.debug({ buttonId }, "Sonoff Energy doublePress");
  }

  protected async executeTriplePress(buttonId: string): Promise<void> {
    logger.debug({ buttonId }, "Sonoff Energy triplePress");
  }

  protected async executeSetIntensity(buttonId: string, intensity: number): Promise<void> {
    logger.debug({ buttonId, intensity }, "Sonoff Energy: keine Dimmung");
  }

}
