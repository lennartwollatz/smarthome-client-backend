import { ModuleDeviceDiscovered } from "../moduleDeviceDiscovered.js";

export class LGDeviceDiscovered implements ModuleDeviceDiscovered {
  id: string;
  name: string;
  address: string;
  port: number;
  serviceType: string;
  manufacturer: string;
  integrator: string;
  macAddress: string | null;

  constructor(
    id: string,
    name: string,
    address: string,
    port: number = 8080,
    serviceType: string = "_airplay._tcp.local",
    manufacturer: string = "",
    integrator: string = "",
    macAddress: string | null = null
  ) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.port = port;
    this.serviceType = serviceType;
    this.manufacturer = manufacturer;
    this.integrator = integrator;
    this.macAddress = macAddress;
  }

  getId() {
    return this.id;
  }

  getName() {
    return this.name;
  }

  getAddress() {
    return this.address;
  }

  getServiceType() {
    return this.serviceType;
  }

  getManufacturer() {
    return this.manufacturer;
  }

  getIntegrator() {
    return this.integrator;
  }

  getMacAddress() {
    return this.macAddress;
  }
}

