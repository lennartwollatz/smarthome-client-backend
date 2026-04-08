import { Button } from "com/smarthome/backend/model/devices/DeviceSwitch.js";

export interface SonoffLanEndDevice {
  ewelinkDeviceId: string;
  lanAddress: string;
  lanPort: number;
  lanApiKey: string;
  getEwelinkDeviceId(): string;
  getLanAddress(): string;
  getLanPort(): number;
  getLanApiKey(): string;
  getButton(buttonId: string): Button | undefined;
}

export class SonoffBasicDevice implements SonoffLanEndDevice {
  ewelinkDeviceId: string = "";
  lanAddress: string = "" ;
  lanPort: number = 8081;
  lanApiKey: string = "";

  constructor(ewelinkDeviceId: string, lanAddress: string, lanPort: number, lanApiKey: string) {
    this.ewelinkDeviceId = ewelinkDeviceId;
    this.lanAddress = lanAddress;
    this.lanPort = lanPort;
    this.lanApiKey = lanApiKey;
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

  getButton(buttonId: string): Button | undefined {
    return undefined;
  }
}
