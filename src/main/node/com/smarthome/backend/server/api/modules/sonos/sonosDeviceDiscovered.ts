import { ModuleDeviceDiscovered } from "../moduleDeviceDiscovered.js";

export class SonosDeviceDiscovered implements ModuleDeviceDiscovered {
  id: string;
  name:string;
  address:string;
  modelName: string;
  modelNumber: string;
  wlanMac: string;
  port: number;
  udn: string;
  serialNumber: string;

  constructor(
    name: string,
    modelName: string,
    modelNumber: string,
    id: string,
    wlanMac: string,
    address: string,
    port: number,
    udn: string,
    serialNumber: string
  ) {
    this.name = name;
    this.modelName = modelName;
    this.modelNumber = modelNumber;
    this.id = id;
    this.wlanMac = wlanMac;
    this.address = address;
    this.port = port;
    this.udn = udn;
    this.serialNumber = serialNumber;
  }
}

