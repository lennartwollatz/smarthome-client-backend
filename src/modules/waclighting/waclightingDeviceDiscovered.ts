import { ModuleDeviceDiscovered } from "../moduleDeviceDiscovered.js";

export class WACLightingDeviceDiscovered implements ModuleDeviceDiscovered {
  id: string;
  name: string;
  address: string;
  port: number;
  mac?: string;
  model?: string;
  manufacturer?: string;
  clientId?: string;
  
  // Daten aus /config-read
  fanInstalled?: boolean;
  lightInstalled?: boolean;
  hasFan?: boolean;
  hasLight?: boolean;
  
  // Static Shadow Data
  firmwareVersion?: string;
  productType?: string;

  constructor(
    id: string,
    name: string,
    address: string,
    port: number = 80,
    mac?: string,
    model?: string,
    manufacturer?: string,
    clientId?: string
  ) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.port = port;
    this.mac = mac;
    this.model = model;
    this.manufacturer = manufacturer;
    this.clientId = clientId;
  }

  getBestConnectionAddress() {
    return this.address ?? null;
  }
}

