export class LGDiscoveredDevice {
  id: string;
  name: string;
  address: string;
  serviceType: string;
  manufacturer: string;
  integrator: string;
  macAddress: string | null;

  constructor(
    id: string,
    name: string,
    address: string,
    serviceType: string,
    manufacturer: string,
    integrator: string,
    macAddress: string | null
  ) {
    this.id = id;
    this.name = name;
    this.address = address;
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

