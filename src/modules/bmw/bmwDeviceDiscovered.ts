import { ModuleDeviceDiscovered } from "../moduleDeviceDiscovered.js";

export class BMWDeviceDiscovered implements ModuleDeviceDiscovered {
  id: string;
  name: string;
  address: string;
  port: number;
  vin: string;
  brand?: string;
  model?: string;

  constructor(id: string, name: string, vin: string, brand?: string, model?: string) {
    this.id = id;
    this.name = name;
    this.vin = vin;
    this.brand = brand;
    this.model = model;
    this.address = vin;
    this.port = 0;
  }
}

