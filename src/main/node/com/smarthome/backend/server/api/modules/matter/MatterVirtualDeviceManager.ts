import { createHash } from "node:crypto";
import { OnOffServer } from "@matter/node/behaviors/on-off";
import { ServerNode, Endpoint, VendorId, DeviceTypeId } from "@matter/main";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import {
  CommissioningFlowType,
  DiscoveryCapabilitiesSchema,
  ManualPairingCodeCodec,
  QrPairingCodeCodec,
} from "@matter/main/types";
import { logger } from "../../../../logger.js";
import { Device } from "../../../../model/devices/Device.js";
import { DevicePresence } from "../../../../model/devices/DevicePresence.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { EventManager } from "../../../events/EventManager.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { UserManager } from "../../entities/users/userManager.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { MatterSpeechAssistant } from "./devices/matterSpeechAssistant.js";
import { MatterVirtual } from "./devices/matterVirtual.js";

/** Wie OnOffPlugInUnitDevice (Lighting-Feature) – fuer {@link setServerOnOff} */
const ON_OFF_SERVER_LIGHTING = OnOffServer.with("Lighting");

const VIRTUAL_BASE_PORT = 5550;

const VENDOR_ID = 4891;
const VENDOR_NAME = "SmartHome";

const PRESENCE_PRODUCT_ID = 8193;
const PRESENCE_PRODUCT_NAME = "Presence";
const VOICE_ASSISTANT_PRODUCT_ID = 8202;
const VOICE_ASSISTANT_PRODUCT_NAME = "Voice Assistant";
const VIRTUAL_PRODUCT_ID = 8204;
const VIRTUAL_PRODUCT_NAME = "Virtual";

const VA_MATTER_BTN_ONOFF = "onoff";

const MATTER_NODE_LABEL_MAX = 32;


interface VirtualDeviceServerInfo {
  server: ServerNode;
  endpoint: Endpoint;
  port: number;
  deviceId: string;
}

interface VirtualDeviceData {
  deviceId: string;
  displayName: string;
  port: number;
  passcode: number;
  discriminator: number;
  qrPairingCode: string;
  pairingCode: string;
  vendorId: number;
  vendorName: string;
  productId: number;
  productName: string;
  nodeId: string;
}

interface VirtualDeviceStored {
  deviceId: string;
  displayName: string;
  userId?: string;
  nodeId: string;
  port: number;
  passcode: number;
  discriminator: number;
  type: DeviceType.VIRTUAL | DeviceType.SPEECH_ASSISTANT | DeviceType.PRESENCE;
}

function snapshotDevice(device: Device): Device {
  return JSON.parse(JSON.stringify(device)) as Device;
}

export class MatterVirtualDeviceManager {
  private servers = new Map<string, VirtualDeviceServerInfo>();
  private stored: JsonRepository<VirtualDeviceStored> | null = null;
  private eventManager: EventManager | null = null;

  private reservedPorts = new Set<number>();
  private onAllVirtualDevicesRestored: (() => void) | null = null;

  constructor(databaseManager: DatabaseManager, private deviceManager: DeviceManager, private userManager: UserManager, eventManager: EventManager) {
    this.stored = new JsonRepository<VirtualDeviceStored>(
      databaseManager,
      "VirtualDeviceStored"
    );
    this.eventManager = eventManager;
  }

  /**
   * Nach Wiederherstellung: z. B. {@link MatterModuleManager} registriert Matter-Binding-Listener erneut.
   * Muss vor {@link startAsyncRestore} gesetzt werden.
   */
  setOnAllVirtualDevicesRestored(callback: (() => void) | null): void {
    this.onAllVirtualDevicesRestored = callback;
  }

  /** Asynchrone Wiederherstellung; erst nach setzen des {@link setOnAllVirtualDevicesRestored}-Callbacks aufrufen. */
  startAsyncRestore(): void {
    void this.initialize().catch(err => {
      logger.error({ err }, "VirtualDeviceManager: Wiederherstellung der virtuellen Geraete fehlgeschlagen");
    });
  }

  /**
   * Startet alle persistierten Presence- und Voice-Assistant-Matter-Server mit gespeichertem Port
   * und Commissioning-Daten; Matter-Event-Handler loesen dieselben Events aus wie bei Neuanlage.
   */
  private async initialize(): Promise<void> {
    if (!this.eventManager || !this.stored) {
      return;
    }

    for (const device of this.stored.findAll()) {
        try {
          await this.restoreDeviceFromStorage(device);
        } catch (err) {
          logger.error({ err, deviceId: device.deviceId }, "Matter-Server: Wiederherstellung fehlgeschlagen");
        }
    }
    try {
      this.onAllVirtualDevicesRestored?.();
    } catch (err) {
      logger.error({ err }, "VirtualDeviceManager: onAllVirtualDevicesRestored-Callback fehlgeschlagen");
    }
  }


  private async restoreDeviceFromStorage(data: VirtualDeviceStored): Promise<void> {
    await this.startDeviceServer(data);
    this.createDeviceIfNotExists(data);
  }

  private async startDeviceServer(data: VirtualDeviceStored): Promise<VirtualDeviceData> {
    if (this.servers.has(data.deviceId)) {
      const existing = this.servers.get(data.deviceId)!;
      try {
        await existing.server.close();
      } catch (err) {
        logger.error({ err, id: data.deviceId }, "Fehler beim Schliessen des bestehenden Server");
      }
      this.servers.delete(data.deviceId);
    }

    const nodeId = data.nodeId;
    const matterDeviceType = DeviceTypeId(OnOffPlugInUnitDevice.deviceType);
    const label = this.truncateMatterNodeLabel(data.displayName);
    const matterUniqueId = createHash("sha256").update(nodeId, "utf8").digest("hex").slice(0, 32);
    const matterSerial = `p${matterUniqueId}`.slice(0, 32);
    const productId = data.type === DeviceType.PRESENCE ? PRESENCE_PRODUCT_ID : data.type === DeviceType.SPEECH_ASSISTANT ? VOICE_ASSISTANT_PRODUCT_ID : VIRTUAL_PRODUCT_ID;
    const productName = data.type === DeviceType.PRESENCE ? PRESENCE_PRODUCT_NAME : data.type === DeviceType.SPEECH_ASSISTANT ? VOICE_ASSISTANT_PRODUCT_NAME : VIRTUAL_PRODUCT_NAME;
    const pairingCode = ManualPairingCodeCodec.encode({
      discriminator: data.discriminator,
      passcode: data.passcode,
    });
    const qrPairingCode = this.encodeQrPairingCode(data.discriminator, data.passcode, productId);

    const server = await ServerNode.create({
      id: nodeId,
      network: { port: data.port },
      commissioning: { passcode: data.passcode, discriminator: data.discriminator },
      productDescription: {
        name: label,
        deviceType: matterDeviceType,
      },
      basicInformation: {
        vendorName: VENDOR_NAME,
        vendorId: VendorId(VENDOR_ID),
        nodeLabel: label,
        productName: productName,
        productLabel: productName,
        productId: productId,
        serialNumber: matterSerial,
        uniqueId: matterUniqueId,
        hardwareVersion: 1,
        hardwareVersionString: "1.0.0",
        softwareVersion: 1,
        softwareVersionString: "1.0.0",
      },
    });

    const ep = new Endpoint(OnOffPlugInUnitDevice, { id: VA_MATTER_BTN_ONOFF });
    await server.add(ep);

    const ev = ep.events as {
      onOff: { onOff$Changed: { on: (fn: (isOn: boolean, wasOn?: boolean) => void) => void } };
    };
    ev.onOff.onOff$Changed.on((isOn: boolean) => {
      this.onStateChanged(data, isOn);
    });

    server.run().catch(err => {
      logger.error({ err, id: data.deviceId }, "Server beendet mit Fehler");
    });

    this.servers.set(data.deviceId, { server, endpoint: ep, port: data.port, deviceId: data.deviceId });
    logger.info({ deviceId:data.deviceId, port: data.port }, "Server gestartet");

    return {
      deviceId: data.deviceId,
      displayName: data.displayName,
      port: data.port,
      passcode: data.passcode,
      discriminator: data.discriminator,
      vendorId: VendorId(VENDOR_ID),
      vendorName: VENDOR_NAME,
      productId: productId,
      productName: productName,
      nodeId: data.nodeId,
      qrPairingCode: qrPairingCode,
      pairingCode: pairingCode,
    };
  }

  private onStateChanged(device: VirtualDeviceStored, on: boolean): void {
    logger.info({ deviceId: device.deviceId, on }, "Anwesenheitsstatus geaendert");
    if( device.type === DeviceType.PRESENCE) {
      this.setPresenceState(device.deviceId, on);
    } else if( device.type === DeviceType.SPEECH_ASSISTANT) {
      this.setSpeechAssistantState(device.deviceId, on);
    } else if( device.type === DeviceType.VIRTUAL) {
      this.setVirtualState(device.deviceId, on);
    }
  }

  private setPresenceState(deviceId: string, present: boolean): boolean {
    const device = this.deviceManager.getDevice(deviceId);
    if (!(device instanceof DevicePresence)) {
      return false;
    }
    device.isConnected = true;
    device.isPairingMode = false;
    if (present) {
      void device.setPresent(false, true);
    } else {
      void device.setAbsent(false, true);
    }
    this.deviceManager.saveDevice(device);
    return true;
  }

  private setSpeechAssistantState(deviceId: string, active: boolean): boolean {
    const device = this.deviceManager.getDevice(deviceId);
    if (!(device instanceof MatterSpeechAssistant)) {
      return false;
    }
    device.isConnected = true;
    device.isPairingMode = false;
    if (active) {
      void device.setActive(false, true);
    } else {
      void device.setInactive(false, true);
    }
    this.deviceManager.saveDevice(device);
    return true;
  }

  private setVirtualState(deviceId: string, active: boolean): boolean {
    const device = this.deviceManager.getDevice(deviceId);
    if (!(device instanceof MatterVirtual)) {
      return false;
    }
    device.isConnected = true;
    device.isPairingMode = false;
    if (active) {
      void device.setActive(false, true);
    } else {
      void device.setInactive(false, true);
    }
    this.deviceManager.saveDevice(device);
    return true;
  }

  /**
   * Manuelle + QR-Payload (MT:…) wie in {@link startDeviceServer} — muss auf dem Device
   * persistieren, sonst liefert GET /devices keine Codes für Apple Home & Co.
   */
  private pairingAndQrFromStored(data: VirtualDeviceStored): { pairingCode: string; qrPairingCode: string } {
    const productId =
      data.type === DeviceType.PRESENCE
        ? PRESENCE_PRODUCT_ID
        : data.type === DeviceType.SPEECH_ASSISTANT
          ? VOICE_ASSISTANT_PRODUCT_ID
          : VIRTUAL_PRODUCT_ID;
    const pairingCode = ManualPairingCodeCodec.encode({
      discriminator: data.discriminator,
      passcode: data.passcode,
    });
    const qrPairingCode = this.encodeQrPairingCode(data.discriminator, data.passcode, productId);
    return { pairingCode, qrPairingCode };
  }

  /** Bestehendes Gerät (z. B. flaches JSON aus der DB) um Commissioning-Felder ergänzen */
  private applyStoredPairingToDevice(
    device: Device,
    data: VirtualDeviceStored,
    pairingCode: string,
    qrPairingCode: string
  ): void {
    if (data.type !== DeviceType.VIRTUAL && data.type !== DeviceType.SPEECH_ASSISTANT) {
      return;
    }
    const d = device as Device & {
      nodeId?: string;
      pairingCode?: string;
      qrPairingCode?: string;
      port?: number;
      passcode?: number;
      discriminator?: number;
    };
    d.nodeId = data.nodeId;
    d.pairingCode = pairingCode;
    d.qrPairingCode = qrPairingCode;
    d.port = data.port;
    d.passcode = data.passcode;
    d.discriminator = data.discriminator;
  }

  private createDeviceIfNotExists(data: VirtualDeviceStored): void {
    const { pairingCode, qrPairingCode } = this.pairingAndQrFromStored(data);
    let device = this.deviceManager.getDevice(data.deviceId);
    if (!device) {
      if (data.type === DeviceType.PRESENCE) {
        device = new DevicePresence({ id: data.deviceId, name: data.displayName, isConnected: true, isPairingMode: true });
      } else if (data.type === DeviceType.SPEECH_ASSISTANT) {
        device = new MatterSpeechAssistant(
          { id: data.deviceId, name: data.displayName, isConnected: true, isPairingMode: true },
          data.nodeId,
          pairingCode,
          qrPairingCode,
          data.port,
          data.passcode,
          data.discriminator
        );
      } else if (data.type === DeviceType.VIRTUAL) {
        device = new MatterVirtual(
          { id: data.deviceId, name: data.displayName, isConnected: true, isPairingMode: true },
          data.nodeId,
          pairingCode,
          qrPairingCode,
          data.port,
          data.passcode,
          data.discriminator
        );
      }
    } else {
      this.applyStoredPairingToDevice(device, data, pairingCode, qrPairingCode);
    }

    if (!device) {
      return;
    }

    if (device instanceof DevicePresence || device instanceof MatterSpeechAssistant || device instanceof MatterVirtual) {
      device.moduleId = "matter";
      device.setEventManager(this.eventManager!);
      this.deviceManager.saveDevice(device);
    } else if (device) {
      const t = (device as Device).type;
      if (t === DeviceType.PRESENCE || t === DeviceType.SPEECH_ASSISTANT || t === DeviceType.VIRTUAL) {
        (device as Device).moduleId = "matter";
        this.deviceManager.saveDevice(device);
      }
    }
  }

  async createPresenceDevice(userId: string): Promise<VirtualDeviceData> {
    const user = this.userManager.findById(userId);
    const displayName = "pres-" + (user?.name?.trim() || "Unbekannt");
    return this.createDevice(displayName, DeviceType.PRESENCE, userId);
  }

  async createVoiceAssistantDevice(name: string): Promise<VirtualDeviceData> {
    return this.createDevice(name, DeviceType.SPEECH_ASSISTANT);
  }

  async createVirtualDevice(name: string): Promise<VirtualDeviceData> {
    return this.createDevice(name, DeviceType.VIRTUAL);
  }

  private async createDevice(
    deviceName: string,
    deviceType: DeviceType.PRESENCE | DeviceType.SPEECH_ASSISTANT | DeviceType.VIRTUAL,
    userId?: string
  ): Promise<VirtualDeviceData> {
    this.ensureRuntime();
    const nodeId = this.generateVirtualNodeId(deviceName);
    const passcode = this.generatePasscode();
    const discriminator = Math.floor(Math.random() * 4096);
    const port = this.allocatePort();

    try {
      const data = await this.startDeviceServer({userId: userId, nodeId:nodeId, deviceId: nodeId, displayName: deviceName, port: port, passcode: passcode, discriminator: discriminator, type: deviceType});
      this.stored!.save(nodeId, {userId: userId, nodeId:nodeId, deviceId: nodeId, displayName: deviceName, port: port, passcode: passcode, discriminator: discriminator, type: deviceType});

      this.createDeviceIfNotExists({userId: userId, nodeId:nodeId, deviceId: nodeId, displayName: deviceName, port: port, passcode: passcode, discriminator: discriminator, type: deviceType});
  
      return data;

    } catch (err) {
      this.releasePort(port);
      throw err;
    }
  }

  async removePresenceDevice(userId: string): Promise<boolean> {
    const user = this.userManager.findById(userId);
    if (!user) {
      return false;
    }
    return this.removeDevice(user.presenceDeviceId);
  }

  async removeDevice(deviceId: string): Promise<boolean> {
    const serverInfo = this.servers.get(deviceId);
    if (serverInfo) {
      try {
        await serverInfo.server.close();
      } catch (err) {
        logger.error({ err, deviceId }, "Fehler beim Stoppen des Servers");
      }
      this.servers.delete(deviceId);
    }
    this.stored!.deleteById(deviceId);
    this.deviceManager.removeDevice(deviceId);
    return true;
  }

  async setUserAbsent(deviceId: string): Promise<boolean> {
    return this.setPresenceState(deviceId, false);
  }
  async setUserPresent(deviceId: string): Promise<boolean> {
    return this.setPresenceState(deviceId, true);
  }

  async setVirtualActive(deviceId: string): Promise<boolean> {
    return this.setVirtualState(deviceId, true);
  }
  async setVirtualInactive(deviceId: string): Promise<boolean> {
    return this.setVirtualState(deviceId, false);
  }

  async setSpeechAssistantActive(deviceId: string): Promise<boolean> {
    return this.setSpeechAssistantState(deviceId, true);
  }
  async setSpeechAssistantInactive(deviceId: string): Promise<boolean> {
    return this.setSpeechAssistantState(deviceId, false);
  }

  /* HELPER FUNCTIONS ---------------------------------------------*/
  private generatePasscode(): number {
    const INVALID = new Set([
      0,
      11111111,
      22222222,
      33333333,
      44444444,
      55555555,
      66666666,
      77777777,
      88888888,
      12345678,
      87654321,
    ]);
    let passcode: number;
    do {
      passcode = Math.floor(Math.random() * 99999998) + 1;
    } while (INVALID.has(passcode));
    return passcode;
  }

  /**
   * Reserviert atomar (synchron, ohne `await`) den nächsten freien Port ab `basePort`.
   *
   * Die Reservierung MUSS nach erfolgreichem Server-Start ODER im Fehlerfall mittels
   * {@link releasePort} freigegeben werden — sonst leakt der Eintrag.
   * Pattern: `try { await start...Server() } finally { releasePort(port) }`
   */
  private allocatePort(): number {
    const used = this.collectAllUsedPorts();
    let port = VIRTUAL_BASE_PORT;
    while (used.has(port)) port++;
    this.reservedPorts.add(port);
    return port;
  }

  /**
 * Liefert ALLE aktuell vergebenen Matter-Ports über alle Geräte-Typen hinweg
 * (Presence, Voice-Assistant, Matter-Host) sowie die in-memory Reservierungen.
 *
 * Dadurch kann jeder Geräte-Typ in seinem Standardbereich starten und beim
 * "Überlauf" automatisch Ports der anderen Bereiche überspringen, sodass
 * niemals zwei Server denselben Port bekommen.
 */
  private collectAllUsedPorts(): Set<number> {
    const used = new Set<number>(this.reservedPorts);
    for (const info of this.servers.values()) used.add(info.port);
    return used;
  }

  private releasePort(port: number): void {
    this.reservedPorts.delete(port);
  }

  private ensureRuntime(): void {
    if (!this.eventManager || !this.stored) {
      throw new Error("MatterVirtualDeviceManager: bindMatterRuntime nicht aufgerufen");
    }
  }

  /**
   * On/Off-Cluster am lokalen Matter-Server setzen (Apple Home, Matter-Controller sehen den Status).
   * Ueber die Cluster-Commands {@code on}/{@code off} (wie bei einer echten Schaltung), damit das
   * Subscription/Reporting zu Home-Hubs greift; reines {@code setStateOf} mit {@code onOff} aktualisiert
   * den Zustand oft nur lokal, sodass Apple Home den Schalter nicht nachzieht.
   */
  async setServerOnOff(deviceId: string, isOn: boolean): Promise<void> {
    const info = this.servers.get(deviceId);
    if (!info) {
      logger.warn({ deviceId }, "setServerOnOff: kein virtueller Matter-Server (Server noch nicht gestartet?)");
      return;
    }
    try {
      const onOff = info.endpoint.commandsOf(ON_OFF_SERVER_LIGHTING);
      if (isOn) {
        await onOff.on(undefined);
      } else {
        await onOff.off(undefined);
      }
    } catch (err) {
      logger.error({ err, deviceId, isOn }, "setServerOnOff: OnOff-Command fehlgeschlagen");
    }
  }


  private encodeQrPairingCode(discriminator: number, passcode: number, productId: number): string {
    return QrPairingCodeCodec.encode([
      {
        version: 0,
        vendorId: VendorId(VENDOR_ID),
        productId: productId,
        flowType: CommissioningFlowType.Standard,
        discriminator,
        passcode,
        discoveryCapabilities: DiscoveryCapabilitiesSchema.encode({ onIpNetwork: true }),
      },
    ]);
  }

  private generateVirtualNodeId(deviceId: string): string {
    const hash = createHash("sha256").update(deviceId, "utf8").digest();
    const hi = hash.readUInt32BE(0);
    const lo = hash.readUInt32BE(4);
    const n = (BigInt(hi) << 32n) | BigInt(lo);
    const masked = n & 0xFFFF_FFFF_FFFFn;
    return String(masked || 1n);
  }


  private truncateMatterNodeLabel(s: string): string {
    if (s.length <= MATTER_NODE_LABEL_MAX) return s;
    return s.slice(0, MATTER_NODE_LABEL_MAX);
  }

}
