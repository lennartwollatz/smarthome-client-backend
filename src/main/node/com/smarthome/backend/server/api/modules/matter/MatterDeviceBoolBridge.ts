import { logger } from "../../../../logger.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import type { DatabaseManager } from "../../../db/database.js";
import type { Device } from "../../../../model/devices/Device.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { EventManager } from "../../../events/EventManager.js";
import { Event } from "../../../events/events/Event.js";
import { getCurrentSource, runWithSource, EventSource } from "../../../events/EventSource.js";
import {
  evaluateDeviceBoolFunction,
  invokeDeviceActionMethodAsync,
  tryInferBoolWritePairForRead,
} from "../../device/deviceMethodReflection.js";
import type { IMatterDeviceEndpointOps } from "./matterDeviceEndpointOps.js";
import {
  type MatterDeviceBoolConfig,
  type MatterDeviceBoolSlot,
  MATTER_BOOL_CONFIG_REPO_TYPE,
  RESERVED_MATTER_BUTTON_IDS,
} from "./matterDeviceBoolTypes.js";
import { MatterSwitch } from "./devices/matterSwitch.js";

/**
 * Liest/steuert Bool-Attribute fremder Geräte über zusätzliche Matter-On/Off-Endpunkte
 * an virtuellen VA- bzw. Matter-Host-Schaltern, inkl. Spiegeln Real → Matter.
 */
export class MatterDeviceBoolBridge {
  private readonly boolConfigRepository: JsonRepository<MatterDeviceBoolConfig>;
  private started = false;

  constructor(
    databaseManager: DatabaseManager,
    private readonly deviceManager: DeviceManager,
    private readonly eventManager: EventManager,
    private readonly endpointOps: IMatterDeviceEndpointOps
  ) {
    this.boolConfigRepository = new JsonRepository<MatterDeviceBoolConfig>(
      databaseManager,
      MATTER_BOOL_CONFIG_REPO_TYPE
    );
  }

  /** Sicherstellen, dass der MatterSwitch im DeviceManager alle Zusatz-Buttons hat, bevor der Server startet. */
  public ensureButtonsForMatterFromStoredConfig(matterDeviceId: string): void {
    const c = this.findByMatterId(matterDeviceId);
    if (c) {
      this.ensureMatterSwitchButtonsForConfig(c);
    }
  }

  public startAfterVirtualDeviceLayer(): void {
    if (this.started) return;
    this.started = true;
    this.eventManager.addOnEventCallback((ev: Event) => {
      this.onDeviceEventForMirror(ev);
    });
    void this.resyncAllFromSources().catch(err => {
      logger.error({ err }, "MatterDeviceBoolBridge: resync all fehlgeschlagen");
    });
  }

  public findByMatterId(matterDeviceId: string): MatterDeviceBoolConfig | null {
    return this.boolConfigRepository.findById(matterDeviceId);
  }

  public async putConfigAndRestart(cfg: MatterDeviceBoolConfig): Promise<void> {
    this.validateConfig(cfg);
    const prev = this.findByMatterId(cfg.matterDeviceId);
    const needMatterServerRestart = slotIdSignature(prev?.slots) !== slotIdSignature(cfg.slots);

    this.boolConfigRepository.save(cfg.matterDeviceId, cfg);
    this.ensureMatterSwitchButtonsForConfig(cfg);
    if (needMatterServerRestart) {
      await this.endpointOps.restartVirtualMatterByDeviceId(cfg.matterDeviceId);
    }
    await this.resyncMatterFromSourceForDeviceId(cfg.matterDeviceId);
  }

  public async removeConfig(matterDeviceId: string): Promise<void> {
    const prev = this.findByMatterId(matterDeviceId);
    const hadSlots = (prev?.slots?.length ?? 0) > 0;
    this.boolConfigRepository.deleteById(matterDeviceId);
    if (hadSlots) {
      await this.endpointOps.restartVirtualMatterByDeviceId(matterDeviceId);
    }
  }

  /** Nur DB-Eintrag — z. B. wenn das Matter-Gerät selbst gelöscht wird. */
  public deleteStoredConfig(matterDeviceId: string): void {
    this.boolConfigRepository.deleteById(matterDeviceId);
  }

  getExtraSlotIdsForMatterDevice(matterDeviceId: string): string[] {
    const c = this.findByMatterId(matterDeviceId);
    if (!c?.slots?.length) return [];
    return c.slots.map(s => s.slotId).filter(Boolean);
  }

  isManagedBoolSlot(matterDeviceId: string, buttonId: string): boolean {
    const c = this.findByMatterId(matterDeviceId);
    if (!c?.slots?.length) return false;
    return c.slots.some(s => s.slotId === buttonId);
  }

  /**
   * Home/Assistant: gemappte Schalter — reales Gerät + ggf. Gruppe, ohne EventSwitch-Workflows.
   */
  public async onMatterUserToggledManagedSlot(
    matterDeviceId: string,
    buttonId: string,
    isOn: boolean
  ): Promise<void> {
    const c = this.findByMatterId(matterDeviceId);
    if (!c?.slots?.length) return;
    const slot = c.slots.find(s => s.slotId === buttonId);
    if (!slot) return;

    await runWithSource(EventSource.AUTOMATION, async () => {
      if (isOn && slot.groupId?.trim()) {
        for (const other of c.slots) {
          if (other.slotId === slot.slotId) continue;
          if (other.groupId !== slot.groupId) continue;
          await this.endpointOps.setVirtualMatterEndpointState(matterDeviceId, other.slotId, false);
          const srcOther = this.deviceManager.getDevice(other.sourceDeviceId);
          if (srcOther) {
            const infOff = tryInferBoolWritePairForRead(srcOther, other.readFunction, other.readArgs);
            const off = other.writeOff?.method ? other.writeOff : infOff?.writeOff;
            if (off?.method) {
              await invokeDeviceActionMethodAsync(srcOther, off.method, off.values ?? []);
            }
          }
        }
      }

      const src = this.deviceManager.getDevice(slot.sourceDeviceId);
      if (!src) {
        logger.warn(
          { sourceDeviceId: slot.sourceDeviceId, matterDeviceId },
          "MatterDeviceBoolBridge: Quellgerät fehlt"
        );
        return;
      }
      const inferred = tryInferBoolWritePairForRead(src, slot.readFunction, slot.readArgs);
      const wOn = slot.writeOn?.method ? slot.writeOn : inferred?.writeOn;
      const wOff = slot.writeOff?.method ? slot.writeOff : inferred?.writeOff;
      if (isOn) {
        if (wOn?.method) {
          await invokeDeviceActionMethodAsync(src, wOn.method, wOn.values ?? []);
        } else {
          logger.warn(
            { matterDeviceId, slot: slot.slotId, readFunction: slot.readFunction },
            "MatterDeviceBoolBridge: kein writeOn (weder config noch Heuristik)"
          );
        }
      } else {
        if (wOff?.method) {
          await invokeDeviceActionMethodAsync(src, wOff.method, wOff.values ?? []);
        } else {
          logger.warn(
            { matterDeviceId, slot: slot.slotId, readFunction: slot.readFunction },
            "MatterDeviceBoolBridge: kein writeOff (weder config noch Heuristik)"
          );
        }
      }
    });
  }

  private onDeviceEventForMirror(ev: Event): void {
    if (getCurrentSource() === EventSource.VOICE) {
      return;
    }
    for (const cfg of this.boolConfigRepository.findAll()) {
      if (!cfg.slots?.length) continue;
      for (const s of cfg.slots) {
        if (s.sourceDeviceId === ev.deviceId) {
          void this.syncMatterStateForSlot(cfg, s).catch(err => {
            logger.error(
              { err, matter: cfg.matterDeviceId, slot: s.slotId },
              "MatterDeviceBoolBridge: Spiegeln fehlgeschlagen"
            );
          });
        }
      }
    }
  }

  private async resyncMatterFromSourceForDeviceId(matterDeviceId: string): Promise<void> {
    const c = this.findByMatterId(matterDeviceId);
    if (!c?.slots?.length) return;
    for (const s of c.slots) {
      await this.syncMatterStateForSlot(c, s);
    }
  }

  private async resyncAllFromSources(): Promise<void> {
    for (const c of this.boolConfigRepository.findAll()) {
      if (c?.slots?.length) {
        await this.resyncMatterFromSourceForDeviceId(c.matterDeviceId);
      }
    }
  }

  private async syncMatterStateForSlot(cfg: MatterDeviceBoolConfig, slot: MatterDeviceBoolSlot): Promise<void> {
    const src = this.deviceManager.getDevice(slot.sourceDeviceId) as (Device & object) | null;
    if (!src) return;
    const v = evaluateDeviceBoolFunction(src, slot.readFunction, slot.readArgs);
    if (v == null) return;
    const matterDevice = this.deviceManager.getDevice(cfg.matterDeviceId);
    if (!(matterDevice instanceof MatterSwitch)) return;
    const curOn = matterDevice.isOn(slot.slotId);
    if (curOn === v) return;
    await this.endpointOps.setVirtualMatterEndpointState(cfg.matterDeviceId, slot.slotId, v);
  }

  private ensureMatterSwitchButtonsForConfig(cfg: MatterDeviceBoolConfig): void {
    const d = this.deviceManager.getDevice(cfg.matterDeviceId);
    if (!(d instanceof MatterSwitch)) return;
    for (const s of cfg.slots) {
      if (RESERVED_MATTER_BUTTON_IDS.has(s.slotId)) continue;
      if (!d.getButton(s.slotId)) {
        d.addButton(s.slotId);
      }
      const b = d.getButton(s.slotId);
      if (b && s.label?.trim()) {
        b.name = s.label.trim();
      }
    }
    this.deviceManager.saveDevice(d);
  }

  private validateConfig(cfg: MatterDeviceBoolConfig): void {
    if (!cfg.matterDeviceId?.trim()) {
      throw new Error("matterDeviceId fehlt");
    }
    if (!Array.isArray(cfg.slots)) {
      throw new Error("slots muss ein Array sein");
    }
    const seen = new Set<string>();
    for (const s of cfg.slots) {
      if (!/^[a-z0-9][a-z0-9_-]{0,30}$/i.test(s.slotId)) {
        throw new Error(`Ungueltige slotId: ${s.slotId}`);
      }
      if (RESERVED_MATTER_BUTTON_IDS.has(s.slotId)) {
        throw new Error(`slotId "${s.slotId}" ist reserviert (onoff/pause/continue).`);
      }
      if (seen.has(s.slotId)) throw new Error(`Doppelte slotId: ${s.slotId}`);
      seen.add(s.slotId);
      if (!s.sourceDeviceId?.trim()) throw new Error(`sourceDeviceId fehlt fuer ${s.slotId}`);
      if (!s.readFunction?.trim()) throw new Error(`readFunction fehlt fuer ${s.slotId}`);
    }
  }
}

function slotIdSignature(slots: MatterDeviceBoolSlot[] | undefined): string {
  if (!slots?.length) {
    return "";
  }
  return [...new Set(slots.map(s => s.slotId).filter(Boolean))].sort().join("\0");
}
