import { logger } from "../../../../logger.js";
import { Device } from "../../../../model/devices/Device.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import type { DatabaseManager } from "../../../db/database.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { invokeDeviceMethodOnDevice, normalizeWorkflowArgList, stripParensBase } from "../../utils/deviceMethodInvoke.js";
import { runWithSource, EventSource } from "../../../events/EventSource.js";
import type { EventManager } from "../../../events/EventManager.js";
import type { Event } from "../../../events/events/Event.js";
import type { MatterSwitchTargetBinding } from "./matterSwitchBindingTypes.js";
import type { MatterVirtualDeviceManager } from "./MatterVirtualDeviceManager.js";
import { VA_MATTER_BTN_ONOFF } from "./voiceAssistantCommandMapping.js";
import { matterSavedTriggerMatchesEvent } from "./matterTriggerEventMatch.js";

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
  /** In der UI oft `values: []` — tatsächliche Aufrufe liefern z. B. `[true]`. Selber Funktionsname reicht. */
  if (n.length === 0) return true;
  return JSON.stringify(n) === JSON.stringify(m);
}

export class MatterSwitchBindingManager {
  private readonly repo: JsonRepository<Stored>;
  private getVirtual: () => MatterVirtualDeviceManager;
  /**
   * Index: pro Zielgerät die Bindings (ohne bei jedem System-Event `findAll` + DB).
   * Zusätzlich: nur `targetDeviceId` mit mindestens einem Trigger, sonst leerer Callback-Body.
   */
  private bindingsByTargetId = new Map<string, Stored[]>();
  private targetIdsWithAnyBinding = new Set<string>();
  private targetIdsWithTrigger = new Set<string>();

  constructor(
    databaseManager: DatabaseManager,
    private deviceManager: DeviceManager,
    getVirtualDeviceManager: () => MatterVirtualDeviceManager,
    eventManager: EventManager
  ) {
    this.repo = new JsonRepository<Stored>(databaseManager, "MatterSwitchTargetBinding");
    this.getVirtual = getVirtualDeviceManager;
    this.rebuildBindingIndex();
    eventManager.addOnEventCallback(event => {
      this.onTargetDeviceEventForMatterFromTrigger(event);
    });
  }

  private rebuildBindingIndex(): void {
    this.bindingsByTargetId.clear();
    this.targetIdsWithAnyBinding.clear();
    this.targetIdsWithTrigger.clear();
    for (const b of this.repo.findAll()) {
      const t = b.targetDeviceId;
      this.targetIdsWithAnyBinding.add(t);
      if (!this.bindingsByTargetId.has(t)) {
        this.bindingsByTargetId.set(t, []);
      }
      this.bindingsByTargetId.get(t)!.push(b);
      if (b.trueTriggerEvent?.trim() || b.falseTriggerEvent?.trim()) {
        this.targetIdsWithTrigger.add(t);
      }
    }
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
    const tTrig = (body.trueTriggerEvent ?? "").trim();
    const fTrig = (body.falseTriggerEvent ?? "").trim();
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
      ...(tTrig ? { trueTriggerEvent: tTrig } : {}),
      ...(fTrig ? { falseTriggerEvent: fTrig } : {}),
    };
    this.repo.save(binding.matterDeviceId, binding);
    this.rebuildBindingIndex();
    return { success: true, binding };
  }

  deleteBinding(matterDeviceId: string): boolean {
    if (!matterDeviceId?.trim()) return false;
    this.repo.deleteById(matterDeviceId.trim());
    this.rebuildBindingIndex();
    return true;
  }

  /**
   * Zielgerät hat ein konfiguriertes Trigger-Ereignis ausgelöst → Matter nur
   * programmgesteuert (Suppress), keine Ziel-Aktion.
   */
  private onTargetDeviceEventForMatterFromTrigger(event: Event): void {
    const { deviceId: targetId } = event;
    if (!targetId || !this.targetIdsWithTrigger.has(targetId)) return;
    const ev = event.eventType as string;
    const list = this.bindingsByTargetId.get(targetId);
    if (!list?.length) return;
    for (const b of list) {
      if (!b.trueTriggerEvent?.trim() && !b.falseTriggerEvent?.trim()) {
        continue;
      }
      if (b.trueTriggerEvent && matterSavedTriggerMatchesEvent(ev, b.trueTriggerEvent)) {
        this.deferMatterSet(b.matterDeviceId, true, "Matter-Trigger: true-Endpoint setzen");
        return;
      }
      if (b.falseTriggerEvent && matterSavedTriggerMatchesEvent(ev, b.falseTriggerEvent)) {
        this.deferMatterSet(b.matterDeviceId, false, "Matter-Trigger: false-Endpoint setzen");
        return;
      }
    }
  }

  /**
   * Matter-Set nach dem `triggerEvent`-Stack (vermeidet synchrone Rückkopplung / hohe Kosten im Callback).
   */
  private deferMatterSet(matterDeviceId: string, isOn: boolean, warnLabel: string): void {
    setImmediate(() => {
      const vdm = this.getVirtual();
      void vdm
        .setMatterEndpointProgrammatically(matterDeviceId, VA_MATTER_BTN_ONOFF, isOn)
        .catch(err => logger.warn({ err, matterDeviceId, warnLabel }, "Matter-Endpoint (deferred) setzen fehlgeschlagen"));
    });
  }

  /**
   * Nach Workflows-Device-Methode: passende Matter-Endpoints setzen.
   */
  onTargetDeviceAction(deviceId: string, methodName: string, values: unknown[]): void {
    if (!this.targetIdsWithAnyBinding.has(deviceId)) return;
    const base = stripParensBase(methodName);
    const list = this.bindingsByTargetId.get(deviceId);
    if (!list?.length) return;
    for (const b of list) {
      if (argsLooselyEqual(b.trueAction, base, values)) {
        this.deferMatterSet(b.matterDeviceId, true, "Matter-Endpoint true");
        return;
      }
      if (argsLooselyEqual(b.falseAction, base, values)) {
        this.deferMatterSet(b.matterDeviceId, false, "Matter-Endpoint false");
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
