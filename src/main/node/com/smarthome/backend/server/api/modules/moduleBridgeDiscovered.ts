
export abstract class ModuleBridgeDiscovered {
  id: string;
  name: string;
  address: string;
  port: number;
  isPaired: boolean;
  devices: string[];

  constructor(id: string, name: string, address: string, port: number = 80) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.port = port;
    this.isPaired = false;
    this.devices = [];
  }


  /**
   * Erstellt eine Kopie der Bridge ohne sensible Daten (z.B. username, clientKey).
   * Muss in abgeleiteten Klassen implementiert werden.
   */
  abstract withoutSensitiveData(): ModuleBridgeDiscovered;
}

