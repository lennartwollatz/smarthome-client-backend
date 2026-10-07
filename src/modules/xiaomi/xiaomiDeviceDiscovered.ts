import { ModuleDeviceDiscovered } from "../moduleDeviceDiscovered.js";

export class XiaomiDeviceDiscovered implements ModuleDeviceDiscovered {
  id: string;
  name: string;
  address: string;
  port: number;
  model?: string;
  token?: string;
  mac?: string;
  did?: string;
  locale?: string;
  status?: string;

  constructor(
    id: string,
    name: string,
    address: string,
    port: number = 54321,
    model?: string,
    token?: string,
    mac?: string,
    did?: string,
    locale?: string,
    status?: string
  ) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.port = port;
    this.model = model;
    this.token = token;
    this.mac = mac;
    this.did = did;
    this.locale = locale;
    this.status = status;
  }

  getBestConnectionAddress() {
    return this.address ?? null;
  }
}

