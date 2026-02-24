import { createRequire } from "node:module";
import { logger } from "../../../../logger.js";
import { SonosDeviceDiscovered } from "./sonosDeviceDiscovered.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import { DatabaseManager } from "../../../db/database.js";
import { SONOSCONFIG, SONOSMODULE } from "./sonosModule.js";

const require = createRequire(import.meta.url);
const DeviceDiscovery = require('sonos').AsyncDeviceDiscovery;

export class SonosDeviceDiscover extends ModuleDeviceDiscover<SonosDeviceDiscovered>{
  
  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  getModuleName(): string {
    return SONOSMODULE.name;
  }
  getDiscoveredDeviceTypeName(): string {
    return SONOSCONFIG.deviceTypeName;
  }

  public async startDiscovery(timeoutSeconds: number): Promise<SonosDeviceDiscovered[]> {
    let discovery = new DeviceDiscovery();
    let discoveredDevices: SonosDeviceDiscovered[] = [];
    
    try {
      const devices = await discovery.discoverMultiple({ timeout: timeoutSeconds * 1000 });
      
      for (const device of devices) {
        try {
          let host = device.host;
          let port = device.port ?? 0;

          // Warte auf die Gerätebeschreibung, bevor das Gerät erstellt wird
          const description = await device.deviceDescription();
          
          const friendlyName = description.roomName ?? "";
          const modelName = description.modelName ?? "";
          const modelNumber = description.modelNumber ?? "";
          const deviceId = description.UDN ?? "";
          const serialNumber = description.serialNum ?? "";
          const wlanMac = description.MACAddress ?? "";
          const udn = description.UDN ?? "";


          let discoveredDevice = new SonosDeviceDiscovered(
            friendlyName,
            modelName,
            modelNumber,
            deviceId,
            wlanMac,
            host,
            port,
            udn,
            serialNumber
          );
          
          discoveredDevices.push(discoveredDevice);
          
        } catch (err) {
          logger.warn(
            { err, host: device.host },
            "Fehler beim Abrufen der Gerätebeschreibung"
          );
        }
      }
      
    } catch (err) {
      logger.error({ err }, "Fehler bei der Sonos Discovery");
    }
    
    return discoveredDevices;
  }

  public async stopDiscovery(): Promise<void> {
    return;
  }
}

