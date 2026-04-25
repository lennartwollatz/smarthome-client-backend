import { createHash, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { Environment, ServerNode, Endpoint, VendorId, DeviceTypeId, StorageService } from "@matter/main";
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
import { runWithSource, EventSource } from "../../../events/EventSource.js";
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
import { MATTERCONFIG } from "./matterModule.js";

const PRESENCE_MODULE_ID = "presence";
const PRESENCE_BASE_PORT = 5550;
const PRESENCE_VENDOR_ID = 0xfff1;
const PRESENCE_PRODUCT_ID = 0x8001;
const HARDWARE_VERSION = "1.0.0";
const SOFTWARE_VERSION = "1.0.0";

const VA_MODULE_ID = "voice-assistant";
const VA_BASE_PORT = 5600;
const VA_VENDOR_ID = 0xfff1;
const VA_PRODUCT_ID = 0x8006;

/** Virtueller Matter-Schalter (Server auf diesem Rechner), Modul-ID wie gekoppelte Matter-Geräte: {@link MATTERCONFIG.id} */
const MATTER_HOST_BASE_PORT = 5700;
const MATTER_HOST_PRODUCT_ID = 0x8007;
const MATTER_ID_MAX = 0xfffe;
const MATTER_VIRTUAL_STORAGE_SCHEMA_VERSION = "v2";

function sanitizeMatterId16(value: number, label: string): number {
  const parsed = Number(value);
  const intValue = Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  const clamped = Math.max(0, Math.min(MATTER_ID_MAX, intValue));
  if (clamped !== intValue) {
    logger.warn(
      { label, raw: value, sanitized: clamped, max: MATTER_ID_MAX },
      "Matter-ID außerhalb Bereich 0..0xFFFE; Wert wurde begrenzt"
    );
  }
  return clamped;
}

const PRESENCE_VENDOR_ID_SAFE = sanitizeMatterId16(PRESENCE_VENDOR_ID, "PRESENCE_VENDOR_ID");
const PRESENCE_PRODUCT_ID_SAFE = sanitizeMatterId16(PRESENCE_PRODUCT_ID, "PRESENCE_PRODUCT_ID");
const VA_VENDOR_ID_SAFE = sanitizeMatterId16(VA_VENDOR_ID, "VA_VENDOR_ID");
const VA_PRODUCT_ID_SAFE = sanitizeMatterId16(VA_PRODUCT_ID, "VA_PRODUCT_ID");
const MATTER_HOST_PRODUCT_ID_SAFE = sanitizeMatterId16(
  MATTER_HOST_PRODUCT_ID,
  "MATTER_HOST_PRODUCT_ID"
);

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

interface MatterHostSwitchDeviceData {
  deviceId: string;
  displayName: string;
  pairingCode: string;
  qrPairingCode: string;
  port: number;
  passcode: number;
  discriminator: number;
}

interface MatterHostSwitchDeviceStored {
  deviceId: string;
  displayName: string;
  port: number;
  passcode: number;
  discriminator: number;
}

interface MatterHostServerInfo {
  server: ServerNode;
  endpoints: Record<string, Endpoint>;
  port: number;
  deviceId: string;
}

function snapshotDevice(device: Device): Device {
  return JSON.parse(JSON.stringify(device)) as Device;
}

export class MatterVirtualDeviceManager {
  private presenceServers = new Map<string, PresenceServerInfo>();
  private vaServers = new Map<string, VoiceAssistantServerInfo>();
  private matterHostServers = new Map<string, MatterHostServerInfo>();
  private deviceDataMap = new Map<string, VoiceAssistantDeviceData>();
  private persistRepository: JsonRepository<VoiceAssistantDeviceStored> | null = null;
  private matterHostRepository: JsonRepository<MatterHostSwitchDeviceStored> | null = null;
  private eventManager: EventManager | null = null;
  private matterPulseSuppress = new Set<string>();
  /**
   * Programmatisches Setzen des Matter-Endpoints (Ziel-Device → Spiegelung), damit
   * kein Voice-Trigger und keine doppelte Binding-Action feuert.
   */
  private vaMatterStateSuppress = new Set<string>();
  private hostMatterStateSuppress = new Set<string>();
  private matterUserToggleFromHub?: (matterDeviceId: string, buttonId: string, isOn: boolean) => void;
  /**
   * In-Memory Reservierung von Matter-Ports zwischen `allocatePort()` und dem späteren
   * Eintrag in eine der Server-Maps (`presenceServers` / `vaServers` / `matterHostServers`).
   *
   * Hintergrund: Die `start*Server`-Methoden tragen den Server erst NACH `await ServerNode.create()`
   * in die zugehörige Map ein. Ohne Reservierung würden zwei parallele `create*Device`-Aufrufe
   * (z. B. zwei gleichzeitige `POST /users`) denselben Port erhalten → der zweite `ServerNode.create`
   * kollidiert auf dem TCP/UDP-Port und der Server lauscht nicht.
   */
  private reservedPorts = new Set<number>();

  constructor(databaseManager: DatabaseManager, private deviceManager: DeviceManager, private userManager: UserManager, eventManager: EventManager) {
    this.persistRepository = new JsonRepository<VoiceAssistantDeviceStored>(
    databaseManager,
    "VoiceAssistantDevice"
    );
    this.matterHostRepository = new JsonRepository<MatterHostSwitchDeviceStored>(
      databaseManager,
      "MatterHostSwitchDevice"
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
    if (!this.eventManager || !this.persistRepository || !this.matterHostRepository) {
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

    for (const row of this.matterHostRepository.findAll()) {
      const data = this.storedRowToMatterHostData(row);
      if (!data) {
        logger.warn({ row }, "MatterHostSwitchDevice: Eintrag unvollstaendig, uebersprungen");
        continue;
      }
      try {
        await this.restoreMatterHostFromStorage(data);
      } catch (err) {
        logger.error({ err, deviceId: data.deviceId }, "Matter-Host-Schalter: Wiederherstellung fehlgeschlagen");
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
      keyword: row.keyword.trim() ?? "location-device",
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
        isConnected: true,
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
      const { virtualNodeId } = this.matterCommissioningIds(data.deviceId);
      const device = new MatterSwitch(
        data.keyword,
        data.deviceId,
        virtualNodeId,
        voiceAssistantActionToButtonIds(data.actionType),
        { moduleId: VA_MODULE_ID, quickAccess: false, isVoiceAssistantDevice: true }
      );
      device.isConnected = true;
      device.isPairingMode = false;
      (device as unknown as Record<string, unknown>).typeLabel = "deviceType.switch";
      this.attachVaMetadata(device, data.keyword, {
        port: data.port,
        passcode: data.passcode,
        discriminator: data.discriminator,
        actionType: data.actionType,
        pairingCode: data.pairingCode,
        qrPairingCode: data.qrPairingCode,
      });
      this.applyVaMatterButtonLabels(device, data.keyword, data.actionType);
      this.deviceManager.saveDevice(device);
    } else {
      this.attachVaMetadata(existing, data.keyword, {
        port: data.port,
        passcode: data.passcode,
        discriminator: data.discriminator,
        actionType: data.actionType,
        pairingCode: data.pairingCode,
        qrPairingCode: data.qrPairingCode,
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
    // Port atomar (synchron) reservieren, BEVOR wir auf Server-Start warten.
    // Andernfalls könnten zwei parallele POST /users denselben Port erhalten.
    const port = this.allocatePort(PRESENCE_BASE_PORT);
    const pairingCode = ManualPairingCodeCodec.encode({
      discriminator,
      passcode,
    });

    const user = this.userManager.findById(userId);
    const displayName = user?.name?.trim() || "Unbekannt";

    try {
      await this.startPresenceServer(userId, displayName, { port, passcode, discriminator });
    } catch (err) {
      this.releasePort(port);
      throw err;
    }
    // Server ist nun in `presenceServers` Map → Reservierung kann freigegeben werden.
    this.releasePort(port);

    const presenceDevice = new DevicePresence({
      id: nodeId,
      name: displayName,
      moduleId: PRESENCE_MODULE_ID,
      isConnected: true,
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
      await this.eraseVaMatterPersistence(deviceId);
      return true;
    })();
  }

  async createMatterHostSwitch(trimmedName: string): Promise<{
    deviceId: string;
    pairingCode: string;
    qrPairingCode: string;
    port: number;
  } | null> {
    this.ensureRuntime();
    const displayName = trimmedName.trim() || "Matter Schalter";
    const deviceId = `mhs-${randomUUID()}`;
    const passcode = this.generatePasscode();
    const discriminator = Math.floor(Math.random() * 4096);
    // Port atomar (synchron) reservieren, BEVOR irgendein `await` läuft.
    // Verhindert Doppelvergabe bei parallelen `createMatterHostSwitch`-Aufrufen.
    const port = this.allocatePort(MATTER_HOST_BASE_PORT);
    const pairingCode = ManualPairingCodeCodec.encode({ discriminator, passcode });
    const qrPairingCode = this.encodeHostQrPairingCode(discriminator, passcode);
    const { virtualNodeId } = this.matterHostCommissioningIds(deviceId);

    const device = new MatterSwitch(
      displayName,
      deviceId,
      virtualNodeId,
      [VA_MATTER_BTN_ONOFF],
      {
        moduleId: MATTERCONFIG.id,
        quickAccess: false,
        isVirtualMatterHost: true,
      }
    );
    device.isConnected = true;
    device.isPairingMode = true;
    (device as unknown as Record<string, unknown>).typeLabel = "deviceType.switch";
    this.applyMatterHostPairingFields(device, { pairingCode, qrPairingCode });
    const swBtn = device.getButton(VA_MATTER_BTN_ONOFF);
    if (swBtn) {
      swBtn.name = `${displayName} · An/Aus`;
    }
    this.deviceManager.saveDevice(device);

    const data: MatterHostSwitchDeviceData = {
      deviceId,
      displayName,
      pairingCode,
      qrPairingCode,
      port,
      passcode,
      discriminator,
    };
    this.matterHostRepository!.save(deviceId, {
      deviceId,
      displayName,
      port,
      passcode,
      discriminator,
    });

    try {
      await this.startMatterHostServer(data);
    } finally {
      // Server (oder Fehler) → Reservierung freigeben. Bei Erfolg ist der Port
      // bereits in `matterHostServers` registriert; bei Fehler war er nie aktiv.
      this.releasePort(port);
    }
    return { deviceId, pairingCode, qrPairingCode, port };
  }

  async removeMatterHostSwitch(deviceId: string): Promise<boolean> {
    const info = this.matterHostServers.get(deviceId);
    if (info) {
      try {
        await info.server.close();
      } catch (err) {
        logger.error({ err, deviceId }, "Matter-Host-Server stoppen fehlgeschlagen");
      }
      this.matterHostServers.delete(deviceId);
    }
    this.matterHostRepository?.deleteById(deviceId);
    await this.eraseMatterHostPersistence(deviceId);
    return true;
  }

  async hostSwitchSetEndpointState(deviceId: string, buttonId: string, on: boolean): Promise<boolean> {
    const info = this.matterHostServers.get(deviceId);
    if (!info) return false;
    const ep = info.endpoints[buttonId];
    if (!ep) return false;
    try {
      await ep.act(`matter-host-set-${buttonId}-${on}`, agent => {
        if (on) {
          agent.get(OnOffServer).on();
        } else {
          agent.get(OnOffServer).off();
        }
      });
    } catch (err) {
      logger.error({ err, deviceId, buttonId, on }, "Matter-Host: Endpoint-Zustand setzen fehlgeschlagen");
      return false;
    }
    return true;
  }

  /**
   * Voice-Assistant-Matter-Server: On/Off am Endpoint setzen (z. B. Spiegelung vom Zielgerät).
   */
  async vaSwitchSetEndpointState(deviceId: string, buttonId: string, on: boolean): Promise<boolean> {
    const info = this.vaServers.get(deviceId);
    if (!info) return false;
    const ep = info.endpoints[buttonId];
    if (!ep) return false;
    try {
      await ep.act(`va-set-${buttonId}-${on}`, agent => {
        if (on) {
          agent.get(OnOffServer).on();
        } else {
          agent.get(OnOffServer).off();
        }
      });
    } catch (err) {
      logger.error({ err, deviceId, buttonId, on }, "Voice-Assistant Matter: Endpoint setzen fehlgeschlagen");
      return false;
    }
    return true;
  }

  setMatterUserToggleHandler(handler: ((matterDeviceId: string, buttonId: string, isOn: boolean) => void) | undefined): void {
    this.matterUserToggleFromHub = handler;
  }

  /**
   * Matter-Endpoint programmatisch setzen (Suppress: kein Workflow-Trigger / keine Doppel-Aktion).
   */
  async setMatterEndpointProgrammatically(deviceId: string, buttonId: string, on: boolean): Promise<boolean> {
    const pk = this.pulseKey(deviceId, buttonId);
    if (this.vaServers.has(deviceId)) {
      this.vaMatterStateSuppress.add(pk);
      const ok = await this.vaSwitchSetEndpointState(deviceId, buttonId, on);
      if (!ok) {
        this.vaMatterStateSuppress.delete(pk);
      }
      return ok;
    }
    if (this.matterHostServers.has(deviceId)) {
      this.hostMatterStateSuppress.add(pk);
      const ok = await this.hostSwitchSetEndpointState(deviceId, buttonId, on);
      if (!ok) {
        this.hostMatterStateSuppress.delete(pk);
      }
      return ok;
    }
    return false;
  }

  /**
   * Entfernt den Matter-Persistenzordner bzw. die SQLite-Datei für diesen VA-Server (`ServerNode`-id = storageId).
   * Betrifft nicht die Paarliste des CommissioningControllers (gekoppelte Fremdgeräte).
   */
  private async eraseVaMatterPersistence(deviceId: string): Promise<void> {
    const { storageId } = this.matterCommissioningIds(deviceId);
    try {
      const storageService = Environment.default.get(StorageService);
      if (!storageService.factory || !storageService.location) {
        return;
      }
      const fileDir = storageService.resolve(storageId);
      const sqliteFile = storageService.resolve(`${storageId}.db`);
      await rm(fileDir, { recursive: true, force: true });
      await rm(sqliteFile, { force: true });
      logger.info({ deviceId, storageId }, "Voice-Assistant: Matter-Speicher für Knoten entfernt");
    } catch (err) {
      logger.warn({ err, deviceId, storageId }, "Voice-Assistant: Matter-Speicher konnte nicht entfernt werden");
    }
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
    // Port atomar (synchron) reservieren, BEVOR irgendein `await` läuft.
    // Verhindert, dass parallele VA-Anlegungen denselben Port bekommen.
    const port = this.allocatePort(VA_BASE_PORT);
    const pairingCode = ManualPairingCodeCodec.encode({ discriminator, passcode });
    const qrPairingCode = this.encodeQrPairingCode(discriminator, passcode);
    const { virtualNodeId } = this.matterCommissioningIds(resolvedDeviceId);

    const device = new MatterSwitch(
      trimmedKeyword,
      resolvedDeviceId,
      virtualNodeId,
      voiceAssistantActionToButtonIds(actionType),
      {
        moduleId: VA_MODULE_ID,
        quickAccess: false,
        isVoiceAssistantDevice: true,
      }
    );
    device.isConnected = true;
    device.isPairingMode = true;
    (device as unknown as Record<string, unknown>).typeLabel = "deviceType.switch";
    this.attachVaMetadata(device, trimmedKeyword, {
      port,
      passcode,
      discriminator,
      actionType,
      pairingCode,
      qrPairingCode,
    });
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
      try {
        await this.startVaServer(data);
      } finally {
        // Server (oder Fehler) → Reservierung freigeben. Bei Erfolg ist der Port
        // bereits in `vaServers` registriert; bei Fehler war er nie aktiv.
        this.releasePort(port);
      }
    } else {
      this.startVaServer(data)
        .catch(err => {
          logger.error({ err, deviceId: resolvedDeviceId }, "Fehler beim Starten des Voice-Assistant-Server");
        })
        .finally(() => {
          this.releasePort(port);
        });
    }

    return new VoiceAssistantTrigger({
      deviceId: resolvedDeviceId,
      keyword: trimmedKeyword,
      actionType,
      matterNodeId: virtualNodeId,
      port,
      passcode,
      discriminator,
      buttonId: voiceAssistantActionToButtonId(actionType),
      pairingCode,
      qrPairingCode,
    });
  }

  private ensureRuntime(): void {
    if (!this.eventManager || !this.persistRepository || !this.matterHostRepository) {
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
        vendorId: VendorId(PRESENCE_VENDOR_ID_SAFE),
        nodeLabel: label,
        productName: label,
        productLabel: label,
        productId: PRESENCE_PRODUCT_ID_SAFE,
        serialNumber: matterSerial,
        uniqueId: matterUniqueId,
        hardwareVersion: 1,
        hardwareVersionString: "1.0",
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
    for (const info of this.presenceServers.values()) used.add(info.port);
    for (const user of this.userManager.findAll()) {
      if (user?.presenceDevicePort) used.add(user.presenceDevicePort);
    }
    for (const info of this.vaServers.values()) used.add(info.port);
    for (const d of this.deviceDataMap.values()) used.add(d.port);
    if (this.persistRepository) {
      for (const row of this.persistRepository.findAll()) {
        if (row?.port != null) used.add(row.port);
      }
    }
    for (const info of this.matterHostServers.values()) used.add(info.port);
    if (this.matterHostRepository) {
      for (const row of this.matterHostRepository.findAll()) {
        if (row?.port != null) used.add(row.port);
      }
    }
    return used;
  }

  /**
   * Reserviert atomar (synchron, ohne `await`) den nächsten freien Port ab `basePort`.
   *
   * Die Reservierung MUSS nach erfolgreichem Server-Start ODER im Fehlerfall mittels
   * {@link releasePort} freigegeben werden — sonst leakt der Eintrag.
   * Pattern: `try { await start...Server() } finally { releasePort(port) }`
   */
  private allocatePort(basePort: number): number {
    const used = this.collectAllUsedPorts();
    let port = basePort;
    while (used.has(port)) port++;
    this.reservedPorts.add(port);
    return port;
  }

  private releasePort(port: number): void {
    this.reservedPorts.delete(port);
  }

  private encodeQrPairingCode(discriminator: number, passcode: number): string {
    // Matter Core §5.1.3: Setup-Payload-Version MUSS 0 sein (alle anderen Werte sind reserviert).
    // Apple Home / Google Home weisen QR-Codes mit version != 0 als ungültig zurück.
    return QrPairingCodeCodec.encode([
      {
        version: 0,
        vendorId: VendorId(VA_VENDOR_ID_SAFE),
        productId: VA_PRODUCT_ID_SAFE,
        flowType: CommissioningFlowType.Standard,
        discriminator,
        passcode,
        discoveryCapabilities: DiscoveryCapabilitiesSchema.encode({ onIpNetwork: true }),
      },
    ]);
  }

  private encodeHostQrPairingCode(discriminator: number, passcode: number): string {
    // Matter Core §5.1.3: Setup-Payload-Version MUSS 0 sein (siehe encodeQrPairingCode).
    return QrPairingCodeCodec.encode([
      {
        version: 0,
        vendorId: VendorId(VA_VENDOR_ID_SAFE),
        productId: MATTER_HOST_PRODUCT_ID_SAFE,
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

  private matterCommissioningIds(deviceId: string): {
    storageId: string;
    matterUniqueId: string;
    matterSerial: string;
    virtualNodeId: string;
  } {
    const matterUniqueId = createHash("sha256").update(deviceId, "utf8").digest("hex").slice(0, 32);
    const matterSerial = `v${matterUniqueId}`.slice(0, 32);
    const safe = deviceId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const baseStorageId =
      safe.length > 0 && safe.length <= 64 ? safe : `va_${matterUniqueId.slice(0, 24)}`;
    const storageId = `${baseStorageId}_${MATTER_VIRTUAL_STORAGE_SCHEMA_VERSION}`;
    const virtualNodeId = this.generateVirtualNodeId(deviceId);
    return { storageId, matterUniqueId, matterSerial, virtualNodeId };
  }

  private matterHostCommissioningIds(deviceId: string): {
    storageId: string;
    matterUniqueId: string;
    matterSerial: string;
    virtualNodeId: string;
  } {
    const matterUniqueId = createHash("sha256").update(deviceId, "utf8").digest("hex").slice(0, 32);
    const matterSerial = `h${matterUniqueId}`.slice(0, 32);
    const safe = deviceId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const baseStorageId =
      safe.length > 0 && safe.length <= 64 ? safe : `mhs_${matterUniqueId.slice(0, 24)}`;
    const storageId = `${baseStorageId}_${MATTER_VIRTUAL_STORAGE_SCHEMA_VERSION}`;
    const virtualNodeId = this.generateVirtualNodeId(deviceId);
    return { storageId, matterUniqueId, matterSerial, virtualNodeId };
  }

  private storedRowToMatterHostData(row: MatterHostSwitchDeviceStored): MatterHostSwitchDeviceData | null {
    if (!row?.deviceId?.trim() || row.port == null || row.passcode == null || row.discriminator == null) {
      return null;
    }
    const { discriminator, passcode } = row;
    const displayName = row.displayName?.trim() || "Matter Schalter";
    return {
      deviceId: row.deviceId.trim(),
      displayName,
      pairingCode: ManualPairingCodeCodec.encode({ discriminator, passcode }),
      qrPairingCode: this.encodeHostQrPairingCode(discriminator, passcode),
      port: row.port,
      passcode,
      discriminator,
    };
  }

  private resolveMatterHostDisplayName(data: MatterHostSwitchDeviceData): string {
    const dev = this.deviceManager.getDevice(data.deviceId);
    const fromDevice = dev?.name?.trim();
    if (fromDevice) return fromDevice;
    return data.displayName.trim();
  }

  private applyMatterHostPairingFields(
    device: MatterSwitch,
    data: Pick<MatterHostSwitchDeviceData, "pairingCode" | "qrPairingCode">
  ): void {
    const r = device as unknown as Record<string, unknown>;
    r.pairingCode = data.pairingCode;
    r.qrPairingCode = data.qrPairingCode;
  }

  private async restoreMatterHostFromStorage(data: MatterHostSwitchDeviceData): Promise<void> {
    const existing = this.deviceManager.getDevice(data.deviceId);
    const { virtualNodeId } = this.matterHostCommissioningIds(data.deviceId);

    if (existing instanceof MatterSwitch && existing.isVirtualMatterHost) {
      this.applyMatterHostPairingFields(existing, data);
      const swBtn = existing.getButton(VA_MATTER_BTN_ONOFF);
      if (swBtn) {
        swBtn.name = `${this.resolveMatterHostDisplayName(data)} · An/Aus`;
      }
      this.deviceManager.saveDevice(existing);
    } else {
      const device = new MatterSwitch(
        data.displayName,
        data.deviceId,
        virtualNodeId,
        [VA_MATTER_BTN_ONOFF],
        { moduleId: MATTERCONFIG.id, quickAccess: false, isVirtualMatterHost: true }
      );
      if (existing) {
        if (existing.name) device.name = existing.name;
        if (existing.room !== undefined) device.room = existing.room;
        device.quickAccess = existing.quickAccess ?? false;
        const icon = (existing as { icon?: string }).icon;
        if (icon) (device as unknown as { icon?: string }).icon = icon;
      }
      device.isConnected = true;
      device.isPairingMode = false;
      (device as unknown as Record<string, unknown>).typeLabel = "deviceType.switch";
      const swBtnNew = device.getButton(VA_MATTER_BTN_ONOFF);
      if (swBtnNew) {
        swBtnNew.name = `${this.resolveMatterHostDisplayName({ ...data, displayName: device.name ?? data.displayName })} · An/Aus`;
      }
      this.applyMatterHostPairingFields(device, data);
      this.deviceManager.saveDevice(device);
    }
    await this.startMatterHostServer(data);
  }

  private async startMatterHostServer(data: MatterHostSwitchDeviceData): Promise<void> {
    if (this.matterHostServers.has(data.deviceId)) return;

    const { storageId, matterUniqueId, matterSerial } = this.matterHostCommissioningIds(data.deviceId);
    const matterDeviceType = DeviceTypeId(OnOffPlugInUnitDevice.deviceType);
    const nodeDisplayName = this.truncateMatterNodeLabel(this.resolveMatterHostDisplayName(data));

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
        vendorId: VendorId(VA_VENDOR_ID_SAFE),
        nodeLabel: nodeDisplayName,
        productName: nodeDisplayName,
        productLabel: nodeDisplayName,
        productId: MATTER_HOST_PRODUCT_ID_SAFE,
        serialNumber: matterSerial,
        uniqueId: matterUniqueId,
        hardwareVersion: 1,
        hardwareVersionString: "1.0",
        softwareVersion: 1,
        softwareVersionString: "1.0.0",
      },
    });

    const endpoints: Record<string, Endpoint> = {};
    const bid = VA_MATTER_BTN_ONOFF;
    const endpointLabel = this.truncateMatterUserLabelValue(
      `${this.resolveMatterHostDisplayName(data)} · An/Aus`
    );
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

    const deviceId = data.deviceId;
    const ev = ep.events as {
      onOff: { onOff$Changed: { on: (fn: (isOn: boolean, wasOn?: boolean) => void) => void } };
    };
    ev.onOff.onOff$Changed.on((isOn: boolean) => runWithSource(EventSource.VOICE, () => {
      const pk = this.pulseKey(deviceId, bid);
      if (this.hostMatterStateSuppress.has(pk)) {
        this.hostMatterStateSuppress.delete(pk);
        this.updateMatterHostButtons(deviceId, { [bid]: isOn });
        return;
      }
      this.updateMatterHostButtons(deviceId, { [bid]: isOn });
      void this.matterUserToggleFromHub?.(deviceId, bid, isOn);
      const d = this.deviceManager.getDevice(deviceId);
      if (!d) return;
      const snap = snapshotDevice(d);
      if (isOn) {
        void this.eventManager!.triggerEvent(new EventSwitchButtonOn(deviceId, snap, bid));
      } else {
        void this.eventManager!.triggerEvent(new EventSwitchButtonOff(deviceId, snap, bid));
      }
    }));

    server.run().catch(err => {
      logger.error({ err, deviceId }, "Matter-Host-Server beendet mit Fehler");
    });

    this.matterHostServers.set(deviceId, {
      server,
      endpoints,
      port: data.port,
      deviceId,
    });
    logger.info({ deviceId, port: data.port }, "Matter-Host-Schalter gestartet");
  }

  private updateMatterHostButtons(deviceId: string, patch: Record<string, boolean>): void {
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

  // Hinweis: Port-Vergabe für alle Matter-Server-Typen erfolgt zentral über
  // `allocatePort(basePort)` (siehe oben). `MATTER_HOST_BASE_PORT` ist der Startwert
  // für Matter-Host-Schalter; bei Belegung wird automatisch der nächste freie Port
  // (auch über die Bereiche von Presence/VA hinweg) gewählt.

  private async eraseMatterHostPersistence(deviceId: string): Promise<void> {
    const { storageId } = this.matterHostCommissioningIds(deviceId);
    try {
      const storageService = Environment.default.get(StorageService);
      if (!storageService.factory || !storageService.location) {
        return;
      }
      const fileDir = storageService.resolve(storageId);
      const sqliteFile = storageService.resolve(`${storageId}.db`);
      await rm(fileDir, { recursive: true, force: true });
      await rm(sqliteFile, { force: true });
      logger.info({ deviceId, storageId }, "Matter-Host: Matter-Speicher entfernt");
    } catch (err) {
      logger.warn({ err, deviceId, storageId }, "Matter-Host: Matter-Speicher konnte nicht entfernt werden");
    }
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
    data: Pick<
      VoiceAssistantDeviceData,
      "port" | "passcode" | "discriminator" | "actionType" | "pairingCode" | "qrPairingCode"
    >
  ): void {
    const r = sw as unknown as Record<string, unknown>;
    r.vaKeyword = keyword;
    r.vaPort = data.port;
    r.vaPasscode = data.passcode;
    r.vaDiscriminator = data.discriminator;
    r.vaActionType = data.actionType;
    // WICHTIG: pairingCode/qrPairingCode müssen am Device persistiert werden, damit das
    // Frontend (z. B. der Voice-Assistant-Dialog im Trigger-Editor) sie über GET /devices
    // aus dem Device-Store lesen kann. Ohne diese Felder schlägt die Validierung
    // („Vorhandenes Gerät") immer fehl, weil pairingCode/qrPairingCode leer sind.
    r.pairingCode = data.pairingCode;
    r.qrPairingCode = data.qrPairingCode;
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
    const fromDevice = dev?.name?.trim() || "location-device";
    if (fromDevice) return fromDevice;
    return data.keyword.trim() || "location-device";
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
        vendorId: VendorId(VA_VENDOR_ID_SAFE),
        nodeLabel: nodeDisplayName,
        productName: nodeDisplayName,
        productLabel: nodeDisplayName,
        productId: VA_PRODUCT_ID_SAFE,
        serialNumber: matterSerial,
        uniqueId: matterUniqueId,
        hardwareVersion: 1,
        hardwareVersionString: "1.0",
        softwareVersion: 1,
        softwareVersionString: "1.0.0",
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
      bindOnOff(epOnoff, (isOn: boolean) => runWithSource(EventSource.VOICE, () => {
        const pk = this.pulseKey(deviceId, VA_MATTER_BTN_ONOFF);
        if (this.vaMatterStateSuppress.has(pk)) {
          this.vaMatterStateSuppress.delete(pk);
          this.updateVaButtons(deviceId, { [VA_MATTER_BTN_ONOFF]: isOn });
          return;
        }
        this.updateVaButtons(deviceId, { [VA_MATTER_BTN_ONOFF]: isOn });
        void this.matterUserToggleFromHub?.(deviceId, VA_MATTER_BTN_ONOFF, isOn);
        const d = this.deviceManager.getDevice(deviceId);
        if (!d) return;
        const snap = snapshotDevice(d);
        if (isOn) {
          void this.eventManager!.triggerEvent(new EventSwitchButtonOn(deviceId, snap, VA_MATTER_BTN_ONOFF));
        } else {
          void this.eventManager!.triggerEvent(new EventSwitchButtonOff(deviceId, snap, VA_MATTER_BTN_ONOFF));
        }
      }));
    } else {
      const epOnoff = endpoints[VA_MATTER_BTN_ONOFF]!;
      const epPause = endpoints[VA_MATTER_BTN_PAUSE]!;
      const epContinue = endpoints[VA_MATTER_BTN_CONTINUE]!;
      bindOnOff(epOnoff, (isOn: boolean) => runWithSource(EventSource.VOICE, () => {
        const pk = this.pulseKey(deviceId, VA_MATTER_BTN_ONOFF);
        if (this.vaMatterStateSuppress.has(pk)) {
          this.vaMatterStateSuppress.delete(pk);
          this.updateVaButtons(deviceId, { [VA_MATTER_BTN_ONOFF]: isOn });
          return;
        }
        this.updateVaButtons(deviceId, { [VA_MATTER_BTN_ONOFF]: isOn });
        void this.matterUserToggleFromHub?.(deviceId, VA_MATTER_BTN_ONOFF, isOn);
        const d = this.deviceManager.getDevice(deviceId);
        if (!d) return;
        const snap = snapshotDevice(d);
        if (isOn) {
          void this.eventManager!.triggerEvent(new EventSwitchButtonOn(deviceId, snap, VA_MATTER_BTN_ONOFF));
        } else {
          void this.eventManager!.triggerEvent(new EventSwitchButtonOff(deviceId, snap, VA_MATTER_BTN_ONOFF));
        }
      }));
      bindOnOff(epPause, (isOn: boolean) => runWithSource(EventSource.VOICE, () => {
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
      }));
      bindOnOff(epContinue, (isOn: boolean) => runWithSource(EventSource.VOICE, () => {
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
      }));
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
