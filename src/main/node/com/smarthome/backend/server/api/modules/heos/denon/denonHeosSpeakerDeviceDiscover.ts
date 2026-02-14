import net from "node:net";
import { logger } from "../../../../../logger.js";
import type { JsonRepository } from "../../../../db/jsonRepository.js";
import { HeosDeviceController } from "../heosDeviceController.js";
import { HeosDeviceDiscover } from "../heosDeviceDiscover.js";
import { HeosDeviceDiscovered } from "../heosDeviceDiscovered.js";
import { DenonSpeaker } from "./devices/denonSpeaker.js";
import type { DatabaseManager } from "../../../../db/database.js";

export class DenonHeosSpeakerDeviceDiscover extends HeosDeviceDiscover {
  private discoveredDeviceRepository: JsonRepository<HeosDeviceDiscovered>;
  private heosController: HeosDeviceController;

  constructor(
    databaseManager: DatabaseManager,
    discoveredDeviceRepository: JsonRepository<HeosDeviceDiscovered>,
    heosController: HeosDeviceController
  ) {
    super(databaseManager, "Denon");
    this.discoveredDeviceRepository = discoveredDeviceRepository;
    this.heosController = heosController;
  }

  getModuleName(): string {
    return "Denon";
  }

  getDiscoveredDeviceTypeName(): string {
    return "HeosDeviceDiscovered";
  }

  async discoverDenonSpeakers(searchDurationMs: number) {
    const discoveredDevices = await this.discoverDevicesWithPlayerIds(searchDurationMs);
    const devicesWithIp = discoveredDevices.filter(device => {
      const address = device.getBestConnectionAddress() ?? "";
      return net.isIP(address) !== 0;
    });
    if (devicesWithIp.length !== discoveredDevices.length) {
      logger.info(
        { total: discoveredDevices.length, filtered: devicesWithIp.length },
        "Geraete ohne IP wurden ignoriert"
      );
    }
    this.saveDiscoveredDevicesToRepository(devicesWithIp);
    return this.convertDiscoveredDevicesToDenonSpeakers(devicesWithIp);
  }

  private saveDiscoveredDevicesToRepository(devices: HeosDeviceDiscovered[]) {
    let savedCount = 0;
    devices.forEach(device => {
      try {
        this.discoveredDeviceRepository.save(device.udn, device);
        savedCount += 1;
        logger.debug(
          { deviceId: device.udn, friendlyName: device.friendlyName, pid: device.pid },
          "HeosDeviceDiscovered gespeichert"
        );
      } catch (err) {
        logger.error({ err, deviceId: device.udn }, "Fehler beim Speichern von HeosDeviceDiscovered");
      }
    });
    logger.info(
      { savedCount, total: devices.length },
      "HeosDeviceDiscovered in Repository gespeichert"
    );
    return savedCount;
  }

  private createDenonSpeakerFromDiscoveredDevice(device: HeosDeviceDiscovered) {
    const deviceId = device.udn;
    const speakerName =
      device.name?.length ? device.name : device.friendlyName ?? "Denon Speaker";
    let address = device.getBestConnectionAddress();
    if (!address) {
      logger.warn(
        { deviceId },
        "Keine gueltige Adresse fuer Gerät gefunden, verwende Fallback"
      );
      address = device.address ?? "unknown";
    }
    return new DenonSpeaker(speakerName, deviceId, address, device.pid ?? 0, this.heosController);
  }

  private convertDiscoveredDevicesToDenonSpeakers(devices: HeosDeviceDiscovered[]) {
    const speakers: DenonSpeaker[] = [];
    devices.forEach(device => {
      try {
        this.discoveredDeviceRepository.save(device.udn, device);
        const speaker = this.createDenonSpeakerFromDiscoveredDevice(device);
        speakers.push(speaker);
        logger.debug(
          { deviceId: device.udn, name: speaker.name, address: device.address },
          "Geraet gespeichert und initialisiert"
        );
      } catch (err) {
        logger.error(
          { err, deviceId: device.udn },
          "Fehler beim Speichern/Initialisieren von Geraet"
        );
      }
    });
    logger.info({ count: speakers.length }, "Geraete zu DenonSpeaker konvertiert");
    return speakers;
  }
}

