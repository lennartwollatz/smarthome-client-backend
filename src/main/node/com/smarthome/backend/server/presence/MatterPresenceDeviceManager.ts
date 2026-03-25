import { ServerNode, Endpoint, VendorId, DeviceTypeId } from "@matter/main";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import { ManualPairingCodeCodec } from "@matter/main/types";
import { logger } from "../../logger.js";
import { Device } from "../../model/devices/Device.js";
import { DeviceType } from "../../model/devices/helper/DeviceType.js";
import type { ActionManager } from "../actions/ActionManager.js";
import type { EventManager } from "../events/EventManager.js";
import type { LiveUpdateService } from "../live/LiveUpdateService.js";
import { JsonRepository } from "../db/jsonRepository.js";
import { User } from "../../model/User.js";
import type { DatabaseManager } from "../db/database.js";

const PRESENCE_MODULE_ID = "presence";
const PRESENCE_BUTTON_ID = "1";
const PRESENCE_BUTTON_NAME = "presence";
const BASE_PORT = 5550;
const VENDOR_ID = 0xFFF1;
const PRODUCT_ID = 0x8001;

interface PresenceServerInfo {
  server: ServerNode;
  endpoint: Endpoint;
  port: number;
  userId: string;
}

export class MatterPresenceDeviceManager {
  private servers = new Map<string, PresenceServerInfo>();
  private userRepository: JsonRepository<User>;
  private liveUpdateService?: LiveUpdateService;

  constructor(
    private actionManager: ActionManager,
    private eventManager: EventManager,
    databaseManager: DatabaseManager
  ) {
    this.userRepository = new JsonRepository<User>(databaseManager, "User");
  }

  setLiveUpdateService(service: LiveUpdateService): void {
    this.liveUpdateService = service;
  }

  async initialize(): Promise<void> {
    const users = this.userRepository.findAll();
    for (const user of users) {
      if (!user?.id) continue;
      if (user.presenceDevicePort != null && user.presencePasscode != null && user.presenceDiscriminator != null) {
        try {
          const correctCode = ManualPairingCodeCodec.encode({
            discriminator: user.presenceDiscriminator,
            passcode: user.presencePasscode,
          });

          if (user.presencePairingCode !== correctCode) {
            user.presencePairingCode = correctCode;
            this.userRepository.save(user.id, user);
            this.liveUpdateService?.emit("user:updated", user);
            logger.info({ userId: user.id }, "Presence-Pairing-Code korrigiert");
          }

          await this.startPresenceServer(user);
          logger.info({ userId: user.id, port: user.presenceDevicePort }, "Presence-Device wiederhergestellt");
        } catch (err) {
          logger.error({ err, userId: user.id }, "Fehler beim Wiederherstellen des Presence-Device");
        }
      }
    }
  }

  async createPresenceDevice(user: User): Promise<{
    manualPairingCode: string;
    port: number;
    passcode: number;
    discriminator: number;
  }> {
    const passcode = this.generatePasscode();
    const discriminator = Math.floor(Math.random() * 4096);
    const port = this.getNextAvailablePort();

    const manualPairingCode = ManualPairingCodeCodec.encode({
      discriminator,
      passcode,
    });

    user.presenceDevicePort = port;
    user.presencePairingCode = manualPairingCode;
    user.presencePasscode = passcode;
    user.presenceDiscriminator = discriminator;

    const device = new Device({
      id: `presence-${user.id}`,
      name: `Anwesenheit: ${user.name ?? "Unbekannt"}`,
      moduleId: PRESENCE_MODULE_ID,
      isConnected: false,
      isPairingMode: true,
      quickAccess: false,
      type: DeviceType.SWITCH,
    }) as Device & { buttons?: Record<string, { on: boolean; pressCount: number; initialPressTime: number; lastPressTime: number; firstPressTime: number; connectedToLight: boolean }> };
    device.buttons = {
      [PRESENCE_BUTTON_ID]: {
        on: false,
        pressCount: 0,
        initialPressTime: 0,
        lastPressTime: 0,
        firstPressTime: 0,
        connectedToLight: false,
        name: PRESENCE_BUTTON_NAME,
      },
    };
    (device as Record<string, unknown>).icon = "🏠";
    (device as Record<string, unknown>).typeLabel = "deviceType.switch";
    this.actionManager.saveDevice(device);

    this.startPresenceServer(user).catch(err => {
      logger.error({ err, userId: user.id }, "Fehler beim Starten des Presence-Server");
    });

    return { manualPairingCode, port, passcode, discriminator };
  }

  async removePresenceDevice(userId: string): Promise<void> {
    const serverInfo = this.servers.get(userId);
    if (serverInfo) {
      try {
        await serverInfo.server.close();
      } catch (err) {
        logger.error({ err, userId }, "Fehler beim Stoppen des Presence-Server");
      }
      this.servers.delete(userId);
    }
    this.actionManager.removeDevice(`presence-${userId}`);
  }

  private async startPresenceServer(user: User): Promise<void> {
    if (!user.id || user.presencePasscode == null || user.presenceDiscriminator == null || !user.presenceDevicePort) {
      return;
    }

    if (this.servers.has(user.id)) return;

    const storageId = `presence-${user.id}`;
    const port = user.presenceDevicePort;
    const passcode = user.presencePasscode;
    const discriminator = user.presenceDiscriminator;
    const userName = user.name ?? "";

    const matterUniqueId = user.id!.replace(/[^a-f0-9]/g, "").slice(0, 32);
    const matterSerial = `p${matterUniqueId}`.slice(0, 32);

    const server = await ServerNode.create({
      id: storageId,
      network: { port },
      commissioning: { passcode, discriminator },
      productDescription: {
        name: `Anwesenheit ${userName}`.trim(),
        deviceType: DeviceTypeId(OnOffPlugInUnitDevice.deviceType),
      },
      basicInformation: {
        vendorName: "SmartHome",
        vendorId: VendorId(VENDOR_ID),
        nodeLabel: `Anwesenheit ${userName}`.trim(),
        productName: `Presence ${userName}`.trim(),
        productLabel: `Presence ${userName}`.trim(),
        productId: PRODUCT_ID,
        serialNumber: matterSerial,
        uniqueId: matterUniqueId,
      },
    });

    const endpoint = new Endpoint(OnOffPlugInUnitDevice, { id: "onoff" });
    await server.add(endpoint);

    const userId = user.id;
    endpoint.events.onOff.onOff$Changed.on(value => {
      this.onPresenceChanged(userId, value);
    });

    server.run().catch(err => {
      logger.error({ err, userId }, "Presence-Server beendet mit Fehler");
    });

    this.servers.set(userId, { server, endpoint, port, userId });
    logger.info({ userId, port }, "Presence-Server gestartet");
  }

  private onPresenceChanged(userId: string, isHome: boolean): void {
    logger.info({ userId, isHome }, "Anwesenheitsstatus geaendert");
    this.updatePresenceButton(userId, isHome);
  }

  /**
   * Aktualisiert den Presence-Button im Device und speichert es.
   * Wird von onPresenceChanged (Matter) und setPresenceButtonState (API) aufgerufen.
   */
  updatePresenceButton(userId: string, isHome: boolean): void {
    const device = this.actionManager.getDevice(`presence-${userId}`) as (Device & {
      buttons?: Record<string, { on: boolean; pressCount: number; initialPressTime: number; lastPressTime: number; firstPressTime: number; connectedToLight: boolean; name?: string }>;
    }) | null;
    if (device) {
      device.isConnected = true;
      device.isPairingMode = false;
      // Migration: Alte Geräte mit Button "0" auf "1" migrieren
      if (device.buttons?.["0"] && !device.buttons[PRESENCE_BUTTON_ID]) {
        device.buttons[PRESENCE_BUTTON_ID] = {
          ...device.buttons["0"],
          name: PRESENCE_BUTTON_NAME,
          on: isHome,
        };
        delete device.buttons["0"];
      }
      if (!device.buttons) {
        device.buttons = {
          [PRESENCE_BUTTON_ID]: {
            on: isHome,
            pressCount: 0,
            initialPressTime: 0,
            lastPressTime: 0,
            firstPressTime: 0,
            connectedToLight: false,
            name: PRESENCE_BUTTON_NAME,
          },
        };
      } else if (device.buttons[PRESENCE_BUTTON_ID]) {
        device.buttons[PRESENCE_BUTTON_ID].on = isHome;
      }
      this.actionManager.saveDevice(device);
    }
  }

  /**
   * Setzt den Presence-Status für einen Benutzer (aufgerufen von API bei Button-Betätigung).
   */
  setPresenceButtonState(userId: string, buttonId: string, on: boolean): boolean {
    if (buttonId !== PRESENCE_BUTTON_ID) return false;
    this.updatePresenceButton(userId, on);
    return true;
  }

  /**
   * Toggle des Presence-Buttons (aufgerufen von API).
   */
  togglePresenceButton(userId: string, buttonId: string): boolean {
    if (buttonId !== PRESENCE_BUTTON_ID) return false;
    const device = this.actionManager.getDevice(`presence-${userId}`) as (Device & {
      buttons?: Record<string, { on: boolean }>;
    }) | null;
    const currentOn = device?.buttons?.[PRESENCE_BUTTON_ID]?.on ?? false;
    this.updatePresenceButton(userId, !currentOn);
    return true;
  }

  private generatePasscode(): number {
    const INVALID = new Set([
      0, 11111111, 22222222, 33333333, 44444444,
      55555555, 66666666, 77777777, 88888888,
      12345678, 87654321,
    ]);
    let passcode: number;
    do {
      passcode = Math.floor(Math.random() * 99999998) + 1;
    } while (INVALID.has(passcode));
    return passcode;
  }

  private getNextAvailablePort(): number {
    const usedPorts = new Set<number>();
    for (const info of this.servers.values()) {
      usedPorts.add(info.port);
    }
    const users = this.userRepository.findAll();
    for (const user of users) {
      if (user?.presenceDevicePort) {
        usedPorts.add(user.presenceDevicePort);
      }
    }
    let port = BASE_PORT;
    while (usedPorts.has(port)) {
      port++;
    }
    return port;
  }
}
