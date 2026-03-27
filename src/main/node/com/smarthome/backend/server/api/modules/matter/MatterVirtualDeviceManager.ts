import { createHash, randomUUID } from "node:crypto";
import { ServerNode, Endpoint, VendorId, DeviceTypeId } from "@matter/main";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import { OnOffServer } from "@matter/main/behaviors/on-off";
import { UserLabelServer } from "@matter/main/behaviors/user-label";
import {
  CommissioningFlowType,
  DiscoveryCapabilitiesSchema,
  ManualPairingCodeCodec,
  QrPairingCodeCodec,
} from "@matter/main/types";
import { logger } from "../../../../logger.js";
import { Device } from "../../../../model/devices/Device.js";
import { DevicePresence } from "../../../../model/devices/DevicePresence.js";
import { MatterSwitch } from "./devices/matterSwitch.js";
import {
  VA_MATTER_BTN_CONTINUE,
  VA_MATTER_BTN_ONOFF,
  VA_MATTER_BTN_PAUSE,
  voiceAssistantActionToButtonId,
  voiceAssistantActionToButtonIds,
  VoiceAssistantCommandAction,
} from "./voiceAssistantCommandMapping.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { EventManager } from "../../../events/EventManager.js";
import { EventSwitchButtonOff } from "../../../events/events/EventSwitchButtonOff.js";
import { EventSwitchButtonOn } from "../../../events/events/EventSwitchButtonOn.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { VoiceAssistantTrigger } from "../../entities/actions/action/VoiceAssistantTrigger.js";
import type { User } from "../../entities/users/User.js";
import { UserManager } from "../../entities/users/userManager.js";

const PRESENCE_MODULE_ID = "presence";
const PRESENCE_BASE_PORT = 5550;
const PRESENCE_VENDOR_ID = 0xfff1;
const PRESENCE_PRODUCT_ID = 0x8001;

const VA_MODULE_ID = "voice-assistant";
const VA_BASE_PORT = 5600;
const VA_VENDOR_ID = 0xfff1;
const VA_PRODUCT_ID = 0x8006;

const OnOffPlugInWithUserLabel = OnOffPlugInUnitDevice.with(UserLabelServer);

const MATTER_NODE_LABEL_MAX = 32;
const MATTER_USER_LABEL_FIELD_MAX = 16;

const VA_MATTER_BUTTON_LABEL: Record<string, string> = {
  [VA_MATTER_BTN_ONOFF]: "Start/Stopp bzw. An/Aus",
  [VA_MATTER_BTN_PAUSE]: "Pause",
  [VA_MATTER_BTN_CONTINUE]: "Fortsetzen",
};

interface PresenceServerInfo {
  server: ServerNode;
  endpoint: Endpoint;
  port: number;
  userId: string;
}

interface VoiceAssistantServerInfo {
  server: ServerNode;
  endpoints: Record<string, Endpoint>;
  port: number;
  deviceId: string;
  keyword: string;
}

interface VoiceAssistantDeviceData {
  deviceId: string;
  keyword: string;
  pairingCode: string;
  qrPairingCode: string;
  port: number;
  passcode: number;
  discriminator: number;
  actionType: VoiceAssistantCommandAction | undefined;
}

interface VoiceAssistantDeviceStored {
  deviceId: string;
  keyword: string;
  port: number;
  passcode: number;
  discriminator: number;
  actionType?: VoiceAssistantCommandAction;
}

function snapshotDevice(device: Device): Device {
  return JSON.parse(JSON.stringify(device)) as Device;
}

export class MatterVirtualDeviceManager {
  private presenceServers = new Map<string, PresenceServerInfo>();
  private vaServers = new Map<string, VoiceAssistantServerInfo>();
  private deviceDataMap = new Map<string, VoiceAssistantDeviceData>();
  private persistRepository: JsonRepository<VoiceAssistantDeviceStored> | null = null;
  private eventManager: EventManager | null = null;
  private matterPulseSuppress = new Set<string>();

  constructor(databaseManager: DatabaseManager, private deviceManager: DeviceManager, private userManager: UserManager, eventManager: EventManager) {
    this.persistRepository = new JsonRepository<VoiceAssistantDeviceStored>(
    databaseManager,
    "VoiceAssistantDevice"
    );
    this.eventManager = eventManager;
    void this.initialize().catch(err => {
    logger.error({ err }, "MatterVirtualDeviceManager: Wiederherstellung der virtuellen Geraete fehlgeschlagen");
    });
  }



  /**
   * Startet alle persistierten Presence- und Voice-Assistant-Matter-Server mit gespeichertem Port
   * und Commissioning-Daten; Matter-Event-Handler loesen dieselben Events aus wie bei Neuanlage.
   */
  private async initialize(): Promise<void> {
    if (!this.eventManager || !this.persistRepository) {
      return;
    }

    for (const user of this.userManager.findAll()) {
      if (!this.userHasPersistedPresence(user)) continue;
      try {
        await this.restorePresenceForUser(user);
      } catch (err) {
        logger.error({ err, userId: user.id }, "Presence Matter-Server: Wiederherstellung fehlgeschlagen");
      }
    }

    for (const row of this.persistRepository.findAll()) {
      const data = this.storedRowToVaData(row);
      if (!data) {
        logger.warn({ row }, "VoiceAssistantDevice: Eintrag unvollstaendig, uebersprungen");
        continue;
      }
      try {
        await this.restoreVoiceAssistantFromStorage(data);
      } catch (err) {
        logger.error({ err, deviceId: data.deviceId }, "Voice-Assistant Matter-Server: Wiederherstellung fehlgeschlagen");
      }
    }
  }

  private userHasPersistedPresence(user: User): boolean {
    return (
      user.presenceDevicePort > 0 &&
      user.presencePasscode > 0 &&
      user.presenceDiscriminator >= 0 &&
      user.presenceDiscriminator <= 4095
    );
  }

  private storedRowToVaData(row: VoiceAssistantDeviceStored): VoiceAssistantDeviceData | null {
    if (
      !row?.deviceId?.trim() ||
      !row.keyword?.trim() ||
      row.port == null ||
      row.passcode == null ||
      row.discriminator == null
    ) {
      return null;
    }
    const { discriminator, passcode } = row;
    return {
      deviceId: row.deviceId.trim(),
      keyword: row.keyword.trim(),
      pairingCode: ManualPairingCodeCodec.encode({ discriminator, passcode }),
      qrPairingCode: this.encodeQrPairingCode(discriminator, passcode),
      port: row.port,
      passcode,
      discriminator,
      actionType: row.actionType,
    };
  }

  private async restorePresenceForUser(user: User): Promise<void> {
    const userId = user.id;
    const nodeId = `presence-${userId}`;
    const displayName = user.name?.trim() || "Unbekannt";
    await this.startPresenceServer(userId, displayName, {
      port: user.presenceDevicePort,
      passcode: user.presencePasscode,
      discriminator: user.presenceDiscriminator,
    });

    let presenceDevice = this.deviceManager.getDevice(nodeId);
    if (!(presenceDevice instanceof DevicePresence)) {
      presenceDevice = new DevicePresence({
        id: nodeId,
        name: displayName,
        moduleId: PRESENCE_MODULE_ID,
        isConnected: false,
        isPairingMode: false,
        quickAccess: false,
        present: user.present,
        lastDetect: new Date().toISOString(),
      });
      (presenceDevice as unknown as Record<string, unknown>).icon = "🏠";
      (presenceDevice as unknown as Record<string, unknown>).typeLabel = "deviceType.presence";
    }
    presenceDevice.setEventManager(this.eventManager!);
    this.deviceManager.saveDevice(presenceDevice);
  }

  private async restoreVoiceAssistantFromStorage(data: VoiceAssistantDeviceData): Promise<void> {
    this.deviceDataMap.set(data.deviceId, data);

    const existing = this.deviceManager.getDevice(data.deviceId);
    const looksLikeVa =
      existing instanceof MatterSwitch &&
      (existing.isVoiceAssistantDevice() || existing.moduleId === VA_MODULE_ID);

    if (!looksLikeVa) {
      const { storageId: matterNodeId } = this.matterCommissioningIds(data.deviceId);
      const device = new MatterSwitch(
        data.keyword,
        data.deviceId,
        matterNodeId,
        voiceAssistantActionToButtonIds(data.actionType),
        { moduleId: VA_MODULE_ID, quickAccess: false, isVoiceAssistantDevice: true }
      );
      device.isConnected = false;
      device.isPairingMode = false;
      (device as unknown as Record<string, unknown>).typeLabel = "deviceType.switch";
      this.attachVaMetadata(device, data.keyword, {
        port: data.port,
        passcode: data.passcode,
        discriminator: data.discriminator,
        actionType: data.actionType,
      });
      this.applyVaMatterButtonLabels(device, data.keyword, data.actionType);
      this.deviceManager.saveDevice(device);
    } else {
      this.attachVaMetadata(existing, data.keyword, {
        port: data.port,
        passcode: data.passcode,
        discriminator: data.discriminator,
        actionType: data.actionType,
      });
      this.applyVaMatterButtonLabels(existing, data.keyword, data.actionType);
      this.deviceManager.saveDevice(existing);
    }

    await this.startVaServer(data);
  }

  setUserAbsent(userId: string): boolean | Promise<boolean> {
    return this.setPresenceState(userId, false);
  }
  setUserPresent(userId: string): boolean | Promise<boolean> {
    return this.setPresenceState(userId, true);
  }

  async createPresenceDevice(
    userId: string
  ): Promise<{
    nodeId: string;
    port: number;
    pairingCode: string;
    passcode: number;
    discriminator: number;
    presenceDeviceId: string;
  }> {
    this.ensureRuntime();
    const nodeId = `presence-${userId}`;
    const passcode = this.generatePasscode();
    const discriminator = Math.floor(Math.random() * 4096);
    const port = this.getNextPresencePort();
    const pairingCode = ManualPairingCodeCodec.encode({
      discriminator,
      passcode,
    });

    const user = this.userManager.findById(userId);
    const displayName = user?.name?.trim() || "Unbekannt";

    await this.startPresenceServer(userId, displayName, { port, passcode, discriminator });

    const presenceDevice = new DevicePresence({
      id: nodeId,
      name: displayName,
      moduleId: PRESENCE_MODULE_ID,
      isConnected: false,
      isPairingMode: true,
      quickAccess: false,
      present: false,
      lastDetect: new Date().toISOString(),
    });
    (presenceDevice as unknown as Record<string, unknown>).icon = "🏠";
    (presenceDevice as unknown as Record<string, unknown>).typeLabel = "deviceType.presence";
    presenceDevice.setEventManager(this.eventManager!);
    this.deviceManager.saveDevice(presenceDevice);

    return { nodeId, pairingCode, port, passcode, discriminator, presenceDeviceId: presenceDevice.id };
  }

  removePresenceDevice(userId: string): boolean | Promise<boolean> {
    return (async () => {
      const serverInfo = this.presenceServers.get(userId);
      if (serverInfo) {
        try {
          await serverInfo.server.close();
        } catch (err) {
          logger.error({ err, userId }, "Fehler beim Stoppen des Presence-Server");
        }
        this.presenceServers.delete(userId);
      }
      this.deviceManager.removeDevice(`presence-${userId}`);
      return true;
    })();
  }

  removeVoiceAssistantDevice(deviceId: string): boolean | Promise<boolean> {
    return (async () => {
      const serverInfo = this.vaServers.get(deviceId);
      if (serverInfo) {
        try {
          await serverInfo.server.close();
        } catch (err) {
          logger.error({ err, deviceId }, "Fehler beim Stoppen des Voice-Assistant-Server");
        }
        this.vaServers.delete(deviceId);
      }
      this.deviceDataMap.delete(deviceId);
      this.persistRepository?.deleteById(deviceId);
      this.deviceManager.removeDevice(deviceId);
      return true;
    })();
  }

  async createVoiceAssistantDevice(
    trimmed: string,
    actionType: VoiceAssistantCommandAction | undefined,
    deviceId: string | undefined
  ): Promise<VoiceAssistantTrigger | null> {
    this.ensureRuntime();
    const trimmedKeyword = trimmed.trim();
    let resolvedDeviceId = deviceId?.trim();
    if (!resolvedDeviceId) {
      resolvedDeviceId = `va-${randomUUID()}`;
    }
    if (this.deviceDataMap.has(resolvedDeviceId) || this.deviceManager.getDevice(resolvedDeviceId)) {
      await this.removeVoiceAssistantDevice(resolvedDeviceId);
    }

    const passcode = this.generatePasscode();
    const discriminator = Math.floor(Math.random() * 4096);
    const port = this.getNextVaPort();
    const pairingCode = ManualPairingCodeCodec.encode({ discriminator, passcode });
    const qrPairingCode = this.encodeQrPairingCode(discriminator, passcode);
    const { storageId: matterNodeId } = this.matterCommissioningIds(resolvedDeviceId);

    const device = new MatterSwitch(
      trimmedKeyword,
      resolvedDeviceId,
      matterNodeId,
      voiceAssistantActionToButtonIds(actionType),
      {
        moduleId: VA_MODULE_ID,
        quickAccess: false,
        isVoiceAssistantDevice: true,
      }
    );
    device.isConnected = false;
    device.isPairingMode = true;
    (device as unknown as Record<string, unknown>).typeLabel = "deviceType.switch";
    this.attachVaMetadata(device, trimmedKeyword, { port, passcode, discriminator, actionType });
    this.applyVaMatterButtonLabels(device, trimmedKeyword, actionType);
    this.deviceManager.saveDevice(device);

    const data: VoiceAssistantDeviceData = {
      deviceId: resolvedDeviceId,
      keyword: trimmedKeyword,
      pairingCode,
      qrPairingCode,
      port,
      passcode,
      discriminator,
      actionType,
    };
    this.deviceDataMap.set(resolvedDeviceId, data);
    this.persistRepository!.save(resolvedDeviceId, this.toStoredFromData(data));

    const awaitServer = Boolean(deviceId?.trim());
    if (awaitServer) {
      await this.startVaServer(data);
    } else {
      this.startVaServer(data).catch(err => {
        logger.error({ err, deviceId: resolvedDeviceId }, "Fehler beim Starten des Voice-Assistant-Server");
      });
    }

    return new VoiceAssistantTrigger({
      deviceId: resolvedDeviceId,
      keyword: trimmedKeyword,
      actionType,
      matterNodeId,
      port,
      passcode,
      discriminator,
      buttonId: voiceAssistantActionToButtonId(actionType),
      pairingCode,
      qrPairingCode,
    });
  }

  private ensureRuntime(): void {
    if (!this.eventManager || !this.persistRepository) {
      throw new Error("MatterVirtualDeviceManager: bindMatterRuntime nicht aufgerufen");
    }
  }

  private setPresenceState(userId: string, present: boolean): boolean {
    const device = this.deviceManager.getDevice(`presence-${userId}`);
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

  private onPresenceChanged(userId: string, isHome: boolean): void {
    logger.info({ userId, isHome }, "Anwesenheitsstatus geaendert");
    this.setPresenceState(userId, isHome);
  }

  private async startPresenceServer(
    userId: string,
    nodeLabel: string,
    params: { port: number; passcode: number; discriminator: number }
  ): Promise<void> {
    if (this.presenceServers.has(userId)) {
      const existing = this.presenceServers.get(userId)!;
      try {
        await existing.server.close();
      } catch (err) {
        logger.error({ err, userId }, "Fehler beim Schliessen des bestehenden Presence-Server");
      }
      this.presenceServers.delete(userId);
    }

    const nodeId = `presence-${userId}`;
    const matterDeviceType = DeviceTypeId(OnOffPlugInUnitDevice.deviceType);
    const label = this.truncateMatterNodeLabel(nodeLabel);
    const matterUniqueId = createHash("sha256").update(nodeId, "utf8").digest("hex").slice(0, 32);
    const matterSerial = `p${matterUniqueId}`.slice(0, 32);

    const server = await ServerNode.create({
      id: nodeId,
      network: { port: params.port },
      commissioning: { passcode: params.passcode, discriminator: params.discriminator },
      productDescription: {
        name: label,
        deviceType: matterDeviceType,
      },
      basicInformation: {
        vendorName: "SmartHome",
        vendorId: VendorId(PRESENCE_VENDOR_ID),
        nodeLabel: label,
        productName: label,
        productLabel: label,
        productId: PRESENCE_PRODUCT_ID,
        serialNumber: matterSerial,
        uniqueId: matterUniqueId,
      },
    });

    const ep = new Endpoint(OnOffPlugInUnitDevice, { id: VA_MATTER_BTN_ONOFF });
    await server.add(ep);

    const ev = ep.events as {
      onOff: { onOff$Changed: { on: (fn: (isOn: boolean, wasOn?: boolean) => void) => void } };
    };
    ev.onOff.onOff$Changed.on((isOn: boolean) => {
      this.onPresenceChanged(userId, isOn);
    });

    server.run().catch(err => {
      logger.error({ err, userId }, "Presence-Server beendet mit Fehler");
    });

    this.presenceServers.set(userId, { server, endpoint: ep, port: params.port, userId });
    logger.info({ userId, port: params.port }, "Presence Matter-Server gestartet");
  }

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

  private getNextPresencePort(): number {
    const usedPorts = new Set<number>();
    for (const info of this.presenceServers.values()) {
      usedPorts.add(info.port);
    }
    for (const user of this.userManager.findAll()) {
      if (user?.presenceDevicePort) {
        usedPorts.add(user.presenceDevicePort);
      }
    }
    let port = PRESENCE_BASE_PORT;
    while (usedPorts.has(port)) {
      port++;
    }
    return port;
  }

  private getNextVaPort(): number {
    const usedPorts = new Set<number>();
    for (const info of this.vaServers.values()) {
      usedPorts.add(info.port);
    }
    for (const d of this.deviceDataMap.values()) {
      usedPorts.add(d.port);
    }
    if (this.persistRepository) {
      for (const row of this.persistRepository.findAll()) {
        if (row?.port != null) {
          usedPorts.add(row.port);
        }
      }
    }
    let port = VA_BASE_PORT;
    while (usedPorts.has(port)) {
      port++;
    }
    return port;
  }

  private encodeQrPairingCode(discriminator: number, passcode: number): string {
    return QrPairingCodeCodec.encode([
      {
        version: 0,
        vendorId: VendorId(VA_VENDOR_ID),
        productId: VA_PRODUCT_ID,
        flowType: CommissioningFlowType.Standard,
        discriminator,
        passcode,
        discoveryCapabilities: DiscoveryCapabilitiesSchema.encode({ onIpNetwork: true }),
      },
    ]);
  }

  private matterCommissioningIds(deviceId: string): {
    storageId: string;
    matterUniqueId: string;
    matterSerial: string;
  } {
    const matterUniqueId = createHash("sha256").update(deviceId, "utf8").digest("hex").slice(0, 32);
    const matterSerial = `v${matterUniqueId}`.slice(0, 32);
    const safe = deviceId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const storageId =
      safe.length > 0 && safe.length <= 64 ? safe : `va_${matterUniqueId.slice(0, 24)}`;
    return { storageId, matterUniqueId, matterSerial };
  }

  private toStoredFromData(data: VoiceAssistantDeviceData): VoiceAssistantDeviceStored {
    return {
      deviceId: data.deviceId,
      keyword: data.keyword,
      port: data.port,
      passcode: data.passcode,
      discriminator: data.discriminator,
      actionType: data.actionType,
    };
  }

  private attachVaMetadata(
    sw: MatterSwitch,
    keyword: string,
    data: Pick<VoiceAssistantDeviceData, "port" | "passcode" | "discriminator" | "actionType">
  ): void {
    const r = sw as unknown as Record<string, unknown>;
    r.vaKeyword = keyword;
    r.vaPort = data.port;
    r.vaPasscode = data.passcode;
    r.vaDiscriminator = data.discriminator;
    r.vaActionType = data.actionType;
  }

  private applyVaMatterButtonLabels(
    sw: MatterSwitch,
    name: string,
    actionType: VoiceAssistantCommandAction | undefined
  ): void {
    const ids = voiceAssistantActionToButtonIds(actionType);
    if (ids.length === 1) {
      sw.getButton(VA_MATTER_BTN_ONOFF)!.name = `${name} · An/Aus`;
      return;
    }
    sw.getButton(VA_MATTER_BTN_ONOFF)!.name = `${name} · Start/Stopp`;
    sw.getButton(VA_MATTER_BTN_PAUSE)!.name = `${name} · Pause`;
    sw.getButton(VA_MATTER_BTN_CONTINUE)!.name = `${name} · Fortsetzen`;
  }

  private vaMatterButtonDisplayName(
    keyword: string,
    buttonId: string,
    actionType: VoiceAssistantCommandAction | undefined
  ): string {
    const ids = voiceAssistantActionToButtonIds(actionType);
    if (ids.length === 1) {
      if (buttonId === VA_MATTER_BTN_ONOFF) return `${keyword} · An/Aus`;
      return VA_MATTER_BUTTON_LABEL[buttonId] ?? buttonId;
    }
    if (buttonId === VA_MATTER_BTN_ONOFF) return `${keyword} · Start/Stopp`;
    if (buttonId === VA_MATTER_BTN_PAUSE) return `${keyword} · Pause`;
    if (buttonId === VA_MATTER_BTN_CONTINUE) return `${keyword} · Fortsetzen`;
    return VA_MATTER_BUTTON_LABEL[buttonId] ?? buttonId;
  }

  private truncateMatterNodeLabel(s: string): string {
    if (s.length <= MATTER_NODE_LABEL_MAX) return s;
    return s.slice(0, MATTER_NODE_LABEL_MAX);
  }

  private truncateMatterUserLabelValue(s: string): string {
    if (s.length <= MATTER_USER_LABEL_FIELD_MAX) return s;
    return s.slice(0, MATTER_USER_LABEL_FIELD_MAX);
  }

  private resolveVaNodeDisplayName(data: VoiceAssistantDeviceData): string {
    const dev = this.deviceManager.getDevice(data.deviceId);
    const fromDevice = dev?.name?.trim();
    if (fromDevice) return fromDevice;
    return data.keyword.trim();
  }

  private resolveVaEndpointDisplayName(data: VoiceAssistantDeviceData, buttonId: string): string {
    const dev = this.deviceManager.getDevice(data.deviceId) as MatterSwitch | null;
    const fromButton = dev?.getButton(buttonId)?.name?.trim();
    if (fromButton) return fromButton;
    return this.vaMatterButtonDisplayName(data.keyword.trim(), buttonId, data.actionType);
  }

  private updateVaButtons(deviceId: string, patch: Record<string, boolean>): void {
    const device = this.deviceManager.getDevice(deviceId) as (Device & {
      buttons?: Record<string, { on: boolean; setOn?: (v: boolean) => void }>;
    }) | null;
    if (!device?.buttons) return;
    device.isConnected = true;
    device.isPairingMode = false;
    for (const [bid, on] of Object.entries(patch)) {
      const b = device.buttons[bid];
      if (b?.setOn) b.setOn(on);
      else if (b) b.on = on;
    }
    this.deviceManager.saveDevice(device);
  }

  private pulseKey(deviceId: string, btn: string): string {
    return `${deviceId}:${btn}`;
  }

  private scheduleMomentaryOff(endpoint: Endpoint, deviceId: string, btnId: string): void {
    this.matterPulseSuppress.add(this.pulseKey(deviceId, btnId));
    void (async () => {
      try {
        await endpoint.act(`va-pulse-off-${btnId}`, agent => {
          agent.get(OnOffServer).off();
        });
      } catch (err) {
        this.matterPulseSuppress.delete(this.pulseKey(deviceId, btnId));
        logger.error({ err, deviceId, btnId }, "Voice-Assistant: Impuls-Aus fehlgeschlagen");
      }
    })();
  }

  private async startVaServer(data: VoiceAssistantDeviceData): Promise<void> {
    if (this.vaServers.has(data.deviceId)) return;

    const { storageId, matterUniqueId, matterSerial } = this.matterCommissioningIds(data.deviceId);
    const matterDeviceType = DeviceTypeId(OnOffPlugInUnitDevice.deviceType);
    const nodeDisplayName = this.truncateMatterNodeLabel(this.resolveVaNodeDisplayName(data));

    const server = await ServerNode.create({
      id: storageId,
      network: { port: data.port },
      commissioning: { passcode: data.passcode, discriminator: data.discriminator },
      productDescription: {
        name: nodeDisplayName,
        deviceType: matterDeviceType,
      },
      basicInformation: {
        vendorName: "SmartHome",
        vendorId: VendorId(VA_VENDOR_ID),
        nodeLabel: nodeDisplayName,
        productName: nodeDisplayName,
        productLabel: nodeDisplayName,
        productId: VA_PRODUCT_ID,
        serialNumber: matterSerial,
        uniqueId: matterUniqueId,
      },
    });

    const endpoints: Record<string, Endpoint> = {};
    const buttonIds = voiceAssistantActionToButtonIds(data.actionType);
    for (const bid of buttonIds) {
      const endpointLabel = this.truncateMatterUserLabelValue(this.resolveVaEndpointDisplayName(data, bid));
      const ep = new Endpoint(
        OnOffPlugInWithUserLabel.set({
          userLabel: {
            labelList: [{ label: "name", value: endpointLabel }],
          },
        }),
        { id: bid }
      );
      await server.add(ep);
      endpoints[bid] = ep;
    }

    const deviceId = data.deviceId;

    const bindOnOff = (ep: Endpoint, handler: (isOn: boolean, wasOn: boolean | undefined) => void) => {
      const ev = ep.events as {
        onOff: { onOff$Changed: { on: (fn: (isOn: boolean, wasOn?: boolean) => void) => void } };
      };
      ev.onOff.onOff$Changed.on(handler);
    };

    if (buttonIds.length === 1) {
      const epOnoff = endpoints[VA_MATTER_BTN_ONOFF]!;
      bindOnOff(epOnoff, (isOn: boolean) => {
        this.updateVaButtons(deviceId, { [VA_MATTER_BTN_ONOFF]: isOn });
        const d = this.deviceManager.getDevice(deviceId);
        if (!d) return;
        const snap = snapshotDevice(d);
        if (isOn) {
          void this.eventManager!.triggerEvent(new EventSwitchButtonOn(deviceId, snap, VA_MATTER_BTN_ONOFF));
        } else {
          void this.eventManager!.triggerEvent(new EventSwitchButtonOff(deviceId, snap, VA_MATTER_BTN_ONOFF));
        }
      });
    } else {
      const epOnoff = endpoints[VA_MATTER_BTN_ONOFF]!;
      const epPause = endpoints[VA_MATTER_BTN_PAUSE]!;
      const epContinue = endpoints[VA_MATTER_BTN_CONTINUE]!;
      bindOnOff(epOnoff, (isOn: boolean) => {
        this.updateVaButtons(deviceId, { [VA_MATTER_BTN_ONOFF]: isOn });
        const d = this.deviceManager.getDevice(deviceId);
        if (!d) return;
        const snap = snapshotDevice(d);
        if (isOn) {
          void this.eventManager!.triggerEvent(new EventSwitchButtonOn(deviceId, snap, VA_MATTER_BTN_ONOFF));
        } else {
          void this.eventManager!.triggerEvent(new EventSwitchButtonOff(deviceId, snap, VA_MATTER_BTN_ONOFF));
        }
      });
      bindOnOff(epPause, (isOn: boolean) => {
        const pk = this.pulseKey(deviceId, VA_MATTER_BTN_PAUSE);
        if (!isOn) {
          if (this.matterPulseSuppress.has(pk)) {
            this.matterPulseSuppress.delete(pk);
            this.updateVaButtons(deviceId, { [VA_MATTER_BTN_PAUSE]: false });
          }
          return;
        }
        this.updateVaButtons(deviceId, { [VA_MATTER_BTN_PAUSE]: true });
        const d = this.deviceManager.getDevice(deviceId);
        if (!d) return;
        const snap = snapshotDevice(d);
        void this.eventManager!.triggerEvent(new EventSwitchButtonOn(deviceId, snap, VA_MATTER_BTN_PAUSE));
        this.scheduleMomentaryOff(epPause, deviceId, VA_MATTER_BTN_PAUSE);
      });
      bindOnOff(epContinue, (isOn: boolean) => {
        const pk = this.pulseKey(deviceId, VA_MATTER_BTN_CONTINUE);
        if (!isOn) {
          if (this.matterPulseSuppress.has(pk)) {
            this.matterPulseSuppress.delete(pk);
            this.updateVaButtons(deviceId, { [VA_MATTER_BTN_CONTINUE]: false });
          }
          return;
        }
        this.updateVaButtons(deviceId, { [VA_MATTER_BTN_CONTINUE]: true });
        const d = this.deviceManager.getDevice(deviceId);
        if (!d) return;
        const snap = snapshotDevice(d);
        void this.eventManager!.triggerEvent(new EventSwitchButtonOn(deviceId, snap, VA_MATTER_BTN_CONTINUE));
        this.scheduleMomentaryOff(epContinue, deviceId, VA_MATTER_BTN_CONTINUE);
      });
    }

    server.run().catch(err => {
      logger.error({ err, deviceId }, "Voice-Assistant-Server beendet mit Fehler");
    });

    this.vaServers.set(deviceId, {
      server,
      endpoints,
      port: data.port,
      deviceId,
      keyword: data.keyword,
    });
    logger.info(
      { deviceId, port: data.port, keyword: data.keyword, actionType: data.actionType },
      "Voice-Assistant Matter-Befehlsserver gestartet"
    );
  }
}
