import type { ModuleDeviceDiscovered } from "../moduleDeviceDiscovered.js";

export class CalendarDeviceDiscovered implements ModuleDeviceDiscovered {
  id: string;
  name: string;
  address: string;
  port: number;
  

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.address = "local";
    this.port = 0;
  }
}


