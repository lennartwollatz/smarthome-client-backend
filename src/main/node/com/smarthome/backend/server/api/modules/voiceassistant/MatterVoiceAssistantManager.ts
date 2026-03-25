import { ServerNode, Endpoint, VendorId, DeviceTypeId } from "@matter/main";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import { ManualPairingCodeCodec } from "@matter/main/types";
import { logger } from "../../../../logger.js";
import { Device } from "../../../../model/devices/Device.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import type { ActionManager } from "../../../actions/ActionManager.js";
import type { EventManager } from "../../../events/EventManager.js";
import type { LiveUpdateService } from "../../../live/LiveUpdateService.js";

const VA_MODULE_ID = "voice-assistant";
const VA_BUTTON_ID = "1";
const VA_BASE_PORT = 5600;
const VENDOR_ID = 0xFFF1;
const PRODUCT_ID = 0x8002;

interface VoiceAssistantServerInfo {
  server: ServerNode;
  endpoint: Endpoint;
  port: number;
  actionId: string;
  keyword: string;
}

interface VoiceAssistantDeviceData {
  actionId: string;
  keyword: string;
  deviceId: string;
  pairingCode: string;
  port: number;
  passcode: number;
  discriminator: number;
}

export class MatterVoiceAssistantManager {
  private servers = new Map<string, VoiceAssistantServerInfo>();
  private deviceDataMap = new Map<string, VoiceAssistantDeviceData>();
  private liveUpdateService?: LiveUpdateService;

  constructor(
    private actionManager: ActionManager,
    private eventManager: EventManager
  ) {}

  setLiveUpdateService(service: LiveUpdateService): void {
    this.liveUpdateService = service;
  }

  async initialize(): Promise<void> {
    const devices = this.actionManager.getDevices();
    for (const device of devices) {
      if (device.moduleId !== VA_MODULE_ID || !device.id) continue;
      const actionId = device.id.replace("va-", "");
      const meta = device as any;
      if (meta.vaPasscode != null && meta.vaDiscriminator != null && meta.vaPort != null) {
        try {
          const keyword = meta.vaKeyword ?? actionId;
          const pairingCode = ManualPairingCodeCodec.encode({
            discriminator: meta.vaDiscriminator,
            passcode: meta.vaPasscode,
          });
          const data: VoiceAssistantDeviceData = {
            actionId,
            keyword,
            deviceId: device.id,
            pairingCode,
            port: meta.vaPort,
            passcode: meta.vaPasscode,
            discriminator: meta.vaDiscriminator,
          };
          this.deviceDataMap.set(actionId, data);
          await this.startServer(data);
          logger.info({ actionId, port: data.port }, "Voice-Assistant-Device wiederhergestellt");
        } catch (err) {
          logger.error({ err, actionId }, "Fehler beim Wiederherstellen des Voice-Assistant-Device");
        }
      }
    }
  }

  async createVoiceAssistantDevice(actionId: string, keyword: string): Promise<{
    deviceId: string;
    pairingCode: string;
  }> {
    await this.removeVoiceAssistantDevice(actionId);

    const passcode = this.generatePasscode();
    const discriminator = Math.floor(Math.random() * 4096);
    const port = this.getNextAvailablePort();
    const deviceId = `va-${actionId}`;

    const pairingCode = ManualPairingCodeCodec.encode({
      discriminator,
      passcode,
    });

    const device = new Device({
      id: deviceId,
      name: keyword,
      moduleId: VA_MODULE_ID,
      isConnected: false,
      isPairingMode: true,
      quickAccess: false,
      type: DeviceType.SWITCH,
    }) as Device & { buttons?: Record<string, any>; vaKeyword?: string; vaPort?: number; vaPasscode?: number; vaDiscriminator?: number };

    device.buttons = {
      [VA_BUTTON_ID]: {
        on: false,
        pressCount: 0,
        initialPressTime: 0,
        lastPressTime: 0,
        firstPressTime: 0,
        connectedToLight: false,
        name: keyword,
      },
    };
    (device as any).typeLabel = "deviceType.switch";
    device.vaKeyword = keyword;
    device.vaPort = port;
    device.vaPasscode = passcode;
    device.vaDiscriminator = discriminator;
    this.actionManager.saveDevice(device);

    const data: VoiceAssistantDeviceData = {
      actionId,
      keyword,
      deviceId,
      pairingCode,
      port,
      passcode,
      discriminator,
    };
    this.deviceDataMap.set(actionId, data);

    this.startServer(data).catch(err => {
      logger.error({ err, actionId }, "Fehler beim Starten des Voice-Assistant-Server");
    });

    return { deviceId, pairingCode };
  }

  async removeVoiceAssistantDevice(actionId: string): Promise<void> {
    const serverInfo = this.servers.get(actionId);
    if (serverInfo) {
      try {
        await serverInfo.server.close();
      } catch (err) {
        logger.error({ err, actionId }, "Fehler beim Stoppen des Voice-Assistant-Server");
      }
      this.servers.delete(actionId);
    }
    const data = this.deviceDataMap.get(actionId);
    if (data) {
      this.actionManager.removeDevice(data.deviceId);
      this.deviceDataMap.delete(actionId);
    } else {
      this.actionManager.removeDevice(`va-${actionId}`);
    }
  }

  getDeviceData(actionId: string): VoiceAssistantDeviceData | undefined {
    return this.deviceDataMap.get(actionId);
  }

  private async startServer(data: VoiceAssistantDeviceData): Promise<void> {
    if (this.servers.has(data.actionId)) return;

    const storageId = `va-${data.actionId}`;
    const matterUniqueId = data.actionId.replace(/[^a-f0-9]/g, "").slice(0, 32);
    const matterSerial = `v${matterUniqueId}`.slice(0, 32);

    const server = await ServerNode.create({
      id: storageId,
      network: { port: data.port },
      commissioning: { passcode: data.passcode, discriminator: data.discriminator },
      productDescription: {
        name: data.keyword,
        deviceType: DeviceTypeId(OnOffPlugInUnitDevice.deviceType),
      },
      basicInformation: {
        vendorName: "SmartHome",
        vendorId: VendorId(VENDOR_ID),
        nodeLabel: data.keyword,
        productName: data.keyword,
        productLabel: data.keyword,
        productId: PRODUCT_ID,
        serialNumber: matterSerial,
        uniqueId: matterUniqueId,
      },
    });

    const endpoint = new Endpoint(OnOffPlugInUnitDevice, { id: "onoff" });
    await server.add(endpoint);

    const actionId = data.actionId;
    const deviceId = data.deviceId;
    endpoint.events.onOff.onOff$Changed.on(value => {
      this.onStateChanged(actionId, deviceId, value);
    });

    server.run().catch(err => {
      logger.error({ err, actionId }, "Voice-Assistant-Server beendet mit Fehler");
    });

    this.servers.set(data.actionId, {
      server,
      endpoint,
      port: data.port,
      actionId: data.actionId,
      keyword: data.keyword,
    });
    logger.info({ actionId, port: data.port, keyword: data.keyword }, "Voice-Assistant-Server gestartet");
  }

  private onStateChanged(actionId: string, deviceId: string, isOn: boolean): void {
    logger.info({ actionId, deviceId, isOn }, "Voice-Assistant Status geaendert");
    this.updateDeviceButton(deviceId, isOn);
  }

  private updateDeviceButton(deviceId: string, isOn: boolean): void {
    const device = this.actionManager.getDevice(deviceId) as (Device & {
      buttons?: Record<string, { on: boolean }>;
    }) | null;
    if (device) {
      device.isConnected = true;
      device.isPairingMode = false;
      if (device.buttons?.[VA_BUTTON_ID]) {
        device.buttons[VA_BUTTON_ID].on = isOn;
      }
      this.actionManager.saveDevice(device);
    }
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
    let port = VA_BASE_PORT;
    while (usedPorts.has(port)) {
      port++;
    }
    return port;
  }
}
