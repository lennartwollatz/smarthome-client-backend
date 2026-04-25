import { logger } from "../../../../logger.js";
import { Device } from "../../../../model/devices/Device.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import type { DatabaseManager } from "../../../db/database.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { invokeDeviceMethodOnDevice, normalizeWorkflowArgList, stripParensBase } from "../../utils/deviceMethodInvoke.js";
import { runWithSource, EventSource } from "../../../events/EventSource.js";
import type { MatterSwitchTargetBinding } from "./matterSwitchBindingTypes.js";
import type { MatterVirtualDeviceManager } from "./MatterVirtualDeviceManager.js";
import { VA_MATTER_BTN_ONOFF } from "./voiceAssistantCommandMapping.js";

type Stored = MatterSwitchTargetBinding;

function argsLooselyEqual(
  a: { functionName: string; values: unknown[] } | undefined,
  invoked: string,
  values: unknown[]
): boolean {
  if (!a) return false;
  if (stripParensBase(a.functionName) !== stripParensBase(invoked)) return false;
  const n = normalizeWorkflowArgList((a.values as unknown[] | undefined) ?? []);
  const m = normalizeWorkflowArgList(values);
  if (n.length === 0 && m.length === 0) return true;
  return JSON.stringify(n) === JSON.stringify(m);
}

export class MatterSwitchBindingManager {
  private readonly repo: JsonRepository<Stored>;
  private getVirtual: () => MatterVirtualDeviceManager;

  constructor(
    databaseManager: DatabaseManager,
    private deviceManager: DeviceManager,
    getVirtualDeviceManager: () => MatterVirtualDeviceManager
  ) {
    this.repo = new JsonRepository<Stored>(databaseManager, "MatterSwitchTargetBinding");
    this.getVirtual = getVirtualDeviceManager;
  }

  getBinding(matterDeviceId: string): MatterSwitchTargetBinding | null {
    if (!matterDeviceId?.trim()) return null;
    return this.repo.findById(matterDeviceId.trim());
  }

  getAllBindings(): MatterSwitchTargetBinding[] {
    return this.repo.findAll();
  }

  /**
   * Speichert oder entfernt die Zuordnung. matterDeviceId = Key.
   */
  saveBinding(
    body: MatterSwitchTargetBinding
  ): { success: true; binding: MatterSwitchTargetBinding } | { success: false; error: string } {
    if (!body.matterDeviceId?.trim() || !body.targetDeviceId?.trim()) {
      return { success: false, error: "matterDeviceId und targetDeviceId erforderlich" };
    }
    if (body.matterDeviceId.trim() === body.targetDeviceId.trim()) {
      return { success: false, error: "Matter-Gerät darf nicht dasselbe wie das Zielgerät sein" };
    }
    if (!body.trueAction?.functionName?.trim() || !body.falseAction?.functionName?.trim()) {
      return { success: false, error: "trueAction und falseAction (functionName) erforderlich" };
    }
    const matter = this.deviceManager.getDevice(body.matterDeviceId.trim());
    if (!matter) {
      return { success: false, error: "Matter-Gerät nicht gefunden" };
    }
    const target = this.deviceManager.getDevice(body.targetDeviceId.trim());
    if (!target) {
      return { success: false, error: "Zielgerät nicht gefunden" };
    }
    const binding: MatterSwitchTargetBinding = {
      matterDeviceId: body.matterDeviceId.trim(),
      targetDeviceId: body.targetDeviceId.trim(),
      trueAction: {
        functionName: body.trueAction.functionName.trim(),
        values: Array.isArray(body.trueAction.values) ? body.trueAction.values : [],
      },
      falseAction: {
        functionName: body.falseAction.functionName.trim(),
        values: Array.isArray(body.falseAction.values) ? body.falseAction.values : [],
      },
    };
    this.repo.save(binding.matterDeviceId, binding);
    return { success: true, binding };
  }

  deleteBinding(matterDeviceId: string): boolean {
    if (!matterDeviceId?.trim()) return false;
    this.repo.deleteById(matterDeviceId.trim());
    return true;
  }

  /**
   * Nach Workflows-Device-Methode: passende Matter-Endpoints setzen.
   */
  onTargetDeviceAction(deviceId: string, methodName: string, values: unknown[]): void {
    const base = stripParensBase(methodName);
    for (const b of this.repo.findAll()) {
      if (b.targetDeviceId !== deviceId) continue;
      const vdm = this.getVirtual();
      if (argsLooselyEqual(b.trueAction, base, values)) {
        void vdm
          .setMatterEndpointProgrammatically(b.matterDeviceId, VA_MATTER_BTN_ONOFF, true)
          .catch(err => logger.warn({ err, matterDeviceId: b.matterDeviceId }, "Matter-Endpoint true setzen"));
        return;
      }
      if (argsLooselyEqual(b.falseAction, base, values)) {
        void vdm
          .setMatterEndpointProgrammatically(b.matterDeviceId, VA_MATTER_BTN_ONOFF, false)
          .catch(err => logger.warn({ err, matterDeviceId: b.matterDeviceId }, "Matter-Endpoint false setzen"));
        return;
      }
    }
  }

  /**
   * Nutzer (Home) hat Matter-Endpoint – Ziel-Action ausführen.
   */
  onMatterUserToggle(matterDeviceId: string, buttonId: string, isOn: boolean): void {
    if (buttonId !== VA_MATTER_BTN_ONOFF) {
      return;
    }
    const b = this.repo.findById(matterDeviceId);
    if (!b) {
      return;
    }
    const target = this.deviceManager.getDevice(b.targetDeviceId) as Device | undefined;
    if (!target) {
      logger.warn({ targetDeviceId: b.targetDeviceId }, "Matter-Binding: Zielgerät fehlt");
      return;
    }
    const spec = isOn ? b.trueAction : b.falseAction;
    void (async () => {
      try {
        const raw = runWithSource(EventSource.VOICE, () =>
          invokeDeviceMethodOnDevice(target, spec.functionName, spec.values ?? [])
        );
        await this.asPromise(raw);
      } catch (err) {
        logger.error({ err, matterDeviceId, isOn }, "Matter-Binding: Ziel-Action fehlgeschlagen");
      }
    })();
  }

  private asPromise(x: unknown): Promise<void> {
    if (x != null && typeof (x as Promise<unknown>).then === "function") {
      return (x as Promise<unknown>).then(() => undefined) as Promise<void>;
    }
    return Promise.resolve();
  }
}
