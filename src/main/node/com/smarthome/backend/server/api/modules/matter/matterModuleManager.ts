import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { Device } from "../../../../model/devices/Device.js";
import type { TemperatureSchedule } from "../../../../model/devices/DeviceThermostat.js";
import { MatterDeviceDiscover } from "./matterDeviceDiscover.js";
import { MatterDeviceDiscovered } from "./matterDeviceDiscovered.js";
import { MatterDeviceController } from "./matterDeviceController.js";
import { MatterEventStreamManager } from "./matterEventStreamManager.js";
import { MatterEvent } from "./matterEvent.js";
import { ModuleManager } from "../moduleManager.js";
import { MATTERCONFIG } from "./matterModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { MatterSwitchEnergy } from "./devices/matterSwitchEnergy.js";
import { MatterSwitch } from "./devices/matterSwitch.js";
import { MatterSwitchDimmer } from "./devices/matterSwitchDimmer.js";
import { matterVendors } from "./matterVendors.js";
import { MatterThermostat } from "./devices/matterThermostat.js";
import { EventManager } from "../../../events/EventManager.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { MatterVirtualDeviceManager } from "./MatterVirtualDeviceManager.js";
import { VoiceAssistantTrigger } from "../../entities/actions/action/VoiceAssistantTrigger.js";
import { ActionManager } from "../../entities/actions/ActionManager.js";
import { UserManager } from "../../entities/users/userManager.js";
import { MatterVirtual } from "./devices/matterVirtual.js";
import { MatterSpeechAssistant } from "./devices/matterSpeechAssistant.js";
import { DeviceVirtualBinding } from "../../../../model/devices/DeviceVirtual.js";
import { invokeDeviceMethodOnDevice } from "../../utils/deviceMethodInvoke.js";
import { EventType } from "../../../events/event-types/EventType.js";
import { DeviceTrigger } from "../../entities/actions/action/DeviceTrigger.js";
import { ActionRunnableResponse } from "../../entities/actions/runnable/ActionRunnableResponse.js";
import { ActionRunnable } from "../../entities/actions/runnable/ActionRunnable.js";
import { ActionRunnableEnvironment } from "../../entities/actions/runnable/ActionRunnableEnvironment.js";
import { EventListener } from "../../../events/EventListener.js";
import { Event } from "../../../events/events/Event.js";

class BindingEventRunnable extends ActionRunnable {
  event: DeviceTrigger;
  private readonly runner: () => Promise<void> | void;

  constructor(id: string, event: DeviceTrigger, runner: () => Promise<void> | void) {
    super(id, id, "event");
    this.event = event;
    this.runner = runner;
  }

  async run(_environment: ActionRunnableEnvironment): Promise<ActionRunnableResponse> {
    await this.runner();
    return { success: true, environment: { environment: new Map<string, unknown>() } };
  }
}

/**
 * Liest den Schaltzustand aus EventLightStatusChanged (resultCondition name "light" → { active }).
 * Einfache/Dimmer/…-Lampen feuern oft nur lightStatusChanged, nicht lightOn/lightOff.
 */
function getLightOnFromStatusChangedEvent(event: Event): boolean | undefined {
  if (event.eventType !== EventType.LIGHT_STATUS_CHANGED) {
    return undefined;
  }
  const r = event.eventResults.find((x) => x.name === "light");
  if (!r || typeof r.value !== "object" || r.value === null) {
    return undefined;
  }
  const v = r.value as { active?: boolean; on?: boolean };
  if (typeof v.active === "boolean") {
    return v.active;
  }
  if (typeof v.on === "boolean") {
    return v.on;
  }
  return undefined;
}

/**
 * Ruft die Matter-Synchronisierung mit dem tatsächlichen Event auf (für lightStatusChanged).
 * Normales EventListener.run() bekommt das Event nicht – daher override von checkedRun.
 */
class MatterLightStatusEventListener extends EventListener {
  constructor(
    listenerId: string,
    targetDeviceId: string,
    private readonly onStatusEvent: (event: Event) => void | Promise<void>
  ) {
    super(
      listenerId,
      targetDeviceId,
      new BindingEventRunnable(
        listenerId,
        new DeviceTrigger({
          triggerDeviceId: targetDeviceId,
          triggerEvent: EventType.LIGHT_STATUS_CHANGED,
          triggerValues: [] as never[],
        }),
        () => Promise.resolve()
      )
    );
  }

  public override checkedRun(event: Event): boolean {
    if (!event.matchesListener(this)) {
      return false;
    }
    void this.onStatusEvent(event);
    return true;
  }
}

function matterPairingLanIpv4(address: string | undefined): string | undefined {
  const s = (address ?? "").trim();
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(s) ? s : undefined;
}

function setMatterDeviceLanIpv4(device: Device, discovered: MatterDeviceDiscovered): void {
  const ip = matterPairingLanIpv4(discovered.address);
  if (ip) device.lanIpv4 = ip;
}

export type PairingPayload = {
  pairingCode: string;
};



export class MatterModuleManager extends ModuleManager<MatterEventStreamManager, MatterDeviceController, MatterDeviceController, MatterEvent, Device, MatterDeviceDiscover, MatterDeviceDiscovered> {
  private virtualDeviceManager: MatterVirtualDeviceManager;
  private suppressNextVirtualAction = new Set<string>();
  private bindingListeners = new Map<string, EventListener[]>();

  constructor(
    databaseManager: DatabaseManager,
    deviceManager: DeviceManager,
    eventManager: EventManager,
    actionManager: ActionManager,
    userManager: UserManager
  ) {
    super(
      databaseManager,
      deviceManager,
      eventManager,
      new MatterDeviceController(databaseManager),
      new MatterDeviceDiscover(databaseManager)
    );
    this.virtualDeviceManager = new MatterVirtualDeviceManager(databaseManager, deviceManager, userManager, eventManager);
    this.virtualDeviceManager.setOnAllVirtualDevicesRestored(() => {
      this.rebuildBindingListenersFromDevices();
    });
    this.virtualDeviceManager.startAsyncRestore();
    this.deviceController.setVirtualOnOffHandler((deviceId, isOn) => this.virtualDeviceManager.setServerOnOff(deviceId, isOn));
    actionManager.setMatterModuleManager(this);
    userManager.setMatterModuleManager(this);
  }

  private rebuildBindingListenersFromDevices(): void {
    for (const listeners of this.bindingListeners.values()) {
      for (const listener of listeners) {
        this.removeEventListenerFromManager(listener);
      }
    }
    this.bindingListeners.clear();
    const devices = this.deviceManager.getDevicesForModule(this.getModuleId());
    for (const device of devices) {
      const d = device as { id: string; type?: DeviceType; attachment?: DeviceVirtualBinding };
      if (d.type !== DeviceType.VIRTUAL || !d.attachment?.deviceId) {
        continue;
      }
      this.registerBindingListeners(d.id, d.attachment);
    }
  }

  private toEventType(value: string | undefined): EventType | undefined {
    if (!value) {
      return undefined;
    }
    const eventTypeValues = Object.values(EventType) as string[];
    if (!eventTypeValues.includes(value)) {
      return undefined;
    }
    return value as EventType;
  }

  private eventManagerListenersMap(): Map<string, Map<EventType, EventListener[]>> {
    const em = this.eventManager as unknown as { listeners: Map<string, Map<EventType, EventListener[]>> };
    return em.listeners;
  }

  private addEventListenerToManager(deviceId: string, eventType: EventType, listener: EventListener): void {
    const listeners = this.eventManagerListenersMap();
    if (!listeners.has(deviceId)) {
      listeners.set(deviceId, new Map<EventType, EventListener[]>());
    }
    const eventMap = listeners.get(deviceId)!;
    if (!eventMap.has(eventType)) {
      eventMap.set(eventType, []);
    }
    eventMap.get(eventType)!.push(listener);
  }

  private removeEventListenerFromManager(listener: EventListener): void {
    const listeners = this.eventManagerListenersMap();
    const eventMap = listeners.get(listener.deviceId);
    if (!eventMap) {
      return;
    }
    for (const [eventType, arr] of eventMap.entries()) {
      const next = arr.filter((l) => l.listenerId !== listener.listenerId);
      if (next.length === 0) {
        eventMap.delete(eventType);
      } else {
        eventMap.set(eventType, next);
      }
    }
    if (eventMap.size === 0) {
      listeners.delete(listener.deviceId);
    }
  }

  private invokeTargetAction(matterDeviceId: string, isActive: boolean): (() => Promise<void>) {
    return async () => {
      if (this.suppressNextVirtualAction.has(matterDeviceId)) {
        this.suppressNextVirtualAction.delete(matterDeviceId);
        return;
      }
      const virtualDevice = this.deviceManager.getDevice(matterDeviceId);
      const d = virtualDevice as Device & { type?: DeviceType; attachment?: DeviceVirtualBinding };
      if (d.type !== DeviceType.VIRTUAL || !d.attachment?.deviceId) {
        return;
      }
      const binding = d.attachment;
      const targetDevice = this.deviceManager.getDevice(binding.deviceId);
      if (!targetDevice) {
        logger.warn({ matterDeviceId, targetDeviceId: binding.deviceId }, "Matter-Binding: Zielgeraet nicht gefunden");
        return;
      }
      const methodName = isActive ? binding.actionActive : binding.actionInactive;
      if (methodName) {
        invokeDeviceMethodOnDevice(targetDevice, methodName, []);
        this.deviceManager.saveDevice(targetDevice);
      }
    };
  }

  private async applyVirtualMatterOnOff(
    matterDeviceId: string,
    isActive: boolean
  ): Promise<void> {
    const device = this.deviceManager.getDevice(matterDeviceId);
    if (!device) {
      return;
    }
    const d = device as Device & { attachment?: DeviceVirtualBinding; active?: boolean };
    if (d.type !== DeviceType.VIRTUAL || !d.attachment) {
      return;
    }
    this.suppressNextVirtualAction.add(matterDeviceId);
    if (device instanceof MatterVirtual) {
      if (isActive) {
        await device.setActive(true, true);
      } else {
        await device.setInactive(true, true);
      }
    } else {
      d.active = isActive;
      await this.virtualDeviceManager.setServerOnOff(matterDeviceId, isActive);
      this.deviceManager.saveDevice(device);
      this.suppressNextVirtualAction.delete(matterDeviceId);
      return;
    }
    this.suppressNextVirtualAction.delete(matterDeviceId);
    this.deviceManager.saveDevice(device);
  }

  private setVirtualStateFromTrigger(
    matterDeviceId: string,
    isActive: boolean
  ): (() => Promise<void>) {
    return async () => {
      const device = this.deviceManager.getDevice(matterDeviceId);
      if (!device) {
        return;
      }
      const d = device as Device & { attachment?: DeviceVirtualBinding; active?: boolean };
      if (d.type !== DeviceType.VIRTUAL) {
        return;
      }
      const binding = d.attachment;
      if (!binding) {
        return;
      }
      const expectedTrigger = isActive ? binding.triggerActive : binding.triggerInactive;
      if (!expectedTrigger) {
        return;
      }
      await this.applyVirtualMatterOnOff(matterDeviceId, isActive);
    };
  }

  private async setVirtualStateFromLightStatusEvent(
    matterDeviceId: string,
    event: Event
  ): Promise<void> {
    const isActive = getLightOnFromStatusChangedEvent(event);
    if (isActive === undefined) {
      return;
    }
    const device = this.deviceManager.getDevice(matterDeviceId);
    if (!device) {
      return;
    }
    const d = device as Device & { attachment?: DeviceVirtualBinding; active?: boolean };
    if (d.type !== DeviceType.VIRTUAL) {
      return;
    }
    if (!d.attachment?.deviceId) {
      return;
    }
    await this.applyVirtualMatterOnOff(matterDeviceId, isActive);
  }

  private registerBindingListeners(matterDeviceId: string, binding: DeviceVirtualBinding): void {
    this.unregisterBindingListeners(matterDeviceId);
    const listeners: EventListener[] = [];

    const virtualActiveListener = new EventListener(
      `matter-binding:${matterDeviceId}:virtual-active`,
      matterDeviceId,
      new BindingEventRunnable(
        `matter-binding:${matterDeviceId}:virtual-active`,
        new DeviceTrigger({ triggerDeviceId: matterDeviceId, triggerEvent: EventType.ACTIVE }),
        this.invokeTargetAction(matterDeviceId, true)
      )
    );
    const virtualInactiveListener = new EventListener(
      `matter-binding:${matterDeviceId}:virtual-inactive`,
      matterDeviceId,
      new BindingEventRunnable(
        `matter-binding:${matterDeviceId}:virtual-inactive`,
        new DeviceTrigger({ triggerDeviceId: matterDeviceId, triggerEvent: EventType.ACTIVE_INACTIVE }),
        this.invokeTargetAction(matterDeviceId, false)
      )
    );
    this.addEventListenerToManager(matterDeviceId, EventType.ACTIVE, virtualActiveListener);
    this.addEventListenerToManager(matterDeviceId, EventType.ACTIVE_INACTIVE, virtualInactiveListener);
    listeners.push(virtualActiveListener, virtualInactiveListener);

    const activeTriggerType = this.toEventType(binding.triggerActive);
    const inactiveTriggerType = this.toEventType(binding.triggerInactive);
    const useLightStatusSync =
      Boolean(binding.deviceId) &&
      activeTriggerType === EventType.LIGHT_ON &&
      inactiveTriggerType === EventType.LIGHT_OFF;

    if (useLightStatusSync) {
      const lightStatusListener = new MatterLightStatusEventListener(
        `matter-binding:${matterDeviceId}:light-status-sync`,
        binding.deviceId,
        (e) => this.setVirtualStateFromLightStatusEvent(matterDeviceId, e)
      );
      this.addEventListenerToManager(binding.deviceId, EventType.LIGHT_STATUS_CHANGED, lightStatusListener);
      listeners.push(lightStatusListener);
    } else {
      if (activeTriggerType && binding.deviceId) {
        const targetActiveListener = new EventListener(
          `matter-binding:${matterDeviceId}:target-active`,
          binding.deviceId,
          new BindingEventRunnable(
            `matter-binding:${matterDeviceId}:target-active`,
            new DeviceTrigger({
              triggerDeviceId: binding.deviceId,
              triggerEvent: activeTriggerType,
              triggerValues: (binding.triggerValuesActive ?? []) as never[],
            }),
            this.setVirtualStateFromTrigger(matterDeviceId, true)
          )
        );
        this.addEventListenerToManager(binding.deviceId, activeTriggerType, targetActiveListener);
        listeners.push(targetActiveListener);
      }

      if (inactiveTriggerType && binding.deviceId) {
        const targetInactiveListener = new EventListener(
          `matter-binding:${matterDeviceId}:target-inactive`,
          binding.deviceId,
          new BindingEventRunnable(
            `matter-binding:${matterDeviceId}:target-inactive`,
            new DeviceTrigger({
              triggerDeviceId: binding.deviceId,
              triggerEvent: inactiveTriggerType,
              triggerValues: (binding.triggerValuesInactive ?? []) as never[],
            }),
            this.setVirtualStateFromTrigger(matterDeviceId, false)
          )
        );
        this.addEventListenerToManager(binding.deviceId, inactiveTriggerType, targetInactiveListener);
        listeners.push(targetInactiveListener);
      }
    }

    this.bindingListeners.set(matterDeviceId, listeners);
  }

  private unregisterBindingListeners(matterDeviceId: string): void {
    const listeners = this.bindingListeners.get(matterDeviceId);
    if (listeners) {
      for (const listener of listeners) {
        this.removeEventListenerFromManager(listener);
      }
    }
    this.bindingListeners.delete(matterDeviceId);
    this.suppressNextVirtualAction.delete(matterDeviceId);
  }

  protected createEventStreamManager(): MatterEventStreamManager {
    return new MatterEventStreamManager(this.getManagerId(), this.deviceController, this.deviceManager);
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.deviceManager.getDevicesForModule(this.getModuleId());
    for (const device of devices) {
      if (device instanceof MatterSwitchEnergy) {
        device.setMatterController(this.deviceController);
      }
      if (device instanceof MatterSwitch) {
        device.setMatterController(this.deviceController);
      }
      if (device instanceof MatterSwitchDimmer) {
        device.setMatterController(this.deviceController);
      }
      if (device instanceof MatterThermostat) {
        device.setMatterController(this.deviceController);
      }
      if (device instanceof MatterSpeechAssistant) {
        device.setMatterController(this.deviceController);
      }
      if (device instanceof MatterVirtual) {
        device.setMatterController(this.deviceController);
      }
    }
    /** Nach DB-→-Klassen-Konvertierung: Ziel-Trigger-Listener erneut (Bindings im Device). */
    this.rebuildBindingListenersFromDevices();
  }

  saveMatterSwitchTargetBinding(
    matterDeviceId: string,
    body: DeviceVirtualBinding
  ): { success: true; binding: DeviceVirtualBinding } | { success: false; error: string } {
    const device = this.deviceManager.getDevice(matterDeviceId);
    if (!device) {
      return { success: false, error: "Device not found" };
    }
    if (device.type !== DeviceType.VIRTUAL) {
      return { success: false, error: "Device is not a virtual device" };
    }
    (device as MatterVirtual).attachment = body;
    this.registerBindingListeners(matterDeviceId, body);
    this.deviceManager.saveDevice(device);
    return { success: true, binding: body };
  }

  removeMatterSwitchTargetBinding(matterDeviceId: string): boolean {
    const device = this.deviceManager.getDevice(matterDeviceId);
    if (!device) {
      return false;
    }
    if (device.type !== DeviceType.VIRTUAL) {
      return false;
    }
    this.unregisterBindingListeners(matterDeviceId);
    (device as MatterVirtual).attachment = undefined;
    return this.deviceManager.saveDevice(device);
  }

  public getModuleId(): string {
    return MATTERCONFIG.id;
  }

  protected getManagerId(): string {
    return MATTERCONFIG.managerId;
  }

  async createPresenceDeviceForUser(userId: string): Promise<{ nodeId: string; port: number; pairingCode: string; passcode: number; discriminator: number; presenceDeviceId: string }> {
    const data = await this.virtualDeviceManager.createPresenceDevice(userId);
    return {
      nodeId: data.nodeId,
      port: data.port,
      pairingCode: data.pairingCode,
      passcode: data.passcode,
      discriminator: data.discriminator,
      presenceDeviceId: data.deviceId,
    };
  }

  async removePresenceDeviceForUser(userId: string): Promise<boolean> {
    return await this.virtualDeviceManager.removePresenceDevice(userId);
  }

  async setUserPresent(userId: string): Promise<boolean> {
    return await this.virtualDeviceManager.setUserPresent(userId);
  }

  async setUserAbsent(userId: string): Promise<boolean> {
    return await this.virtualDeviceManager.setUserAbsent(userId);
  }

  async createVoiceAssistantDevice(name: string): Promise<VoiceAssistantTrigger | null> {
    return await this.virtualDeviceManager.createVoiceAssistantDevice(name);
  }

  async removeVoiceAssistantDevice(deviceId: string): Promise<boolean> {
    return await this.virtualDeviceManager.removeDevice(deviceId);
  }

  async createVirtualDevice(name: string): Promise<{
    deviceId: string;
    pairingCode: string;
    qrPairingCode: string;
    port: number;
  } | null> {
    return await this.virtualDeviceManager.createVirtualDevice(name);
  }

  async removeVirtualDevice(deviceId: string): Promise<boolean> {
    return await this.virtualDeviceManager.removeDevice(deviceId);
  }

  


  async discoverDevices(): Promise<MatterDeviceDiscovered[]> {
    try {
      const existingDevices = this.deviceManager.getDevicesForModule(this.getModuleId());
      return await this.deviceDiscover.discover(5, existingDevices.map(d => d.id));
    } catch (err) {
      logger.error({ err }, "Fehler bei der Geraeteerkennung");
      return [];
    }
  }

  async pairDevice(
    deviceId: string,
    payload: PairingPayload
  ): Promise<{ success: boolean; nodeId?: string | number | bigint | boolean; deviceId?: string; error?:string}> {
    logger.info({ deviceId }, "Starte Matter Pairing");

    let device = this.deviceDiscover.getStored(deviceId);

    if (!device) {
      return await this.pairDeviceByCode(payload);
    }

    if( device.isPaired ?? false){
      return { success: true, nodeId: device.nodeId, deviceId: deviceId };
    }

    const pairedDevice = await this.deviceController.pairDevice(device, payload);

    if (!pairedDevice) {
      logger.warn({ deviceId }, "Pairing fehlgeschlagen (kein Node zurückgegeben)");
      return { success: false, error: "Pairing fehlgeschlagen (kein Node zurückgegeben)" };
    }
    // Persistenz im Discovered Device: Pairing-/Verbindungsdaten sollen dort liegen (nicht im Device selbst)
    this.deviceDiscover.setStored(deviceId, pairedDevice);


    const matterDevice = await this.toMatterDevice(pairedDevice);
    const saved = this.deviceManager.saveDevice(matterDevice);
    if (saved) {
      //this.initialiseEventStreamManager();
    }
    return { success: saved, nodeId: pairedDevice.nodeId ?? undefined, deviceId: matterDevice.id };
  }

  async unpairDevice(deviceId: string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    return this.deviceController.unpairDevice(device as MatterSwitchEnergy | MatterSwitch | MatterSwitchDimmer);
  }

  /**
   * Pairing/Commissioning nur über den Code (ohne vorheriges Discover eines konkreten Geräts).
   * Speichert anschließend ein Device im ActionManager.
   */
  async pairDeviceByCode(
    payload: PairingPayload
  ): Promise<{ success: boolean; nodeId?: string | number | bigint | boolean; deviceId?: string; error?:string }> {
    logger.info("Starte Matter Pairing by Code");
    if (!payload) return { success: false };

    let pairedDevice = await this.deviceController.pairDeviceByCode(payload);
    if (!pairedDevice) {
      return { success: false, error: "Pairing fehlgeschlagen (kein Node zurückgegeben)" };
    }
    // Persistenz im Discovered Device: Pairing-/Verbindungsdaten sollen dort liegen (nicht im Device selbst)
    this.deviceDiscover.setStored(pairedDevice.id, pairedDevice);


    const matterDevice = await this.toMatterDevice(pairedDevice);
    const saved = this.deviceManager.saveDevice(matterDevice);
    if (saved) {
      //this.initialiseEventStreamManager();
    }
    return { success: saved, nodeId: pairedDevice.nodeId ?? undefined, deviceId: matterDevice.id };
  }

  private toDeviceType(deviceTypeKey: string | null): DeviceType | null {
    if (!deviceTypeKey) return null;
    // `matterVendors.ts` nutzt aktuell i18n Keys wie "device.switch"
    if (deviceTypeKey === "device.switch") return DeviceType.SWITCH;
    if (deviceTypeKey === "device.switch-dimmer") return DeviceType.SWITCH_DIMMER;
    if (deviceTypeKey === "device.switch-energy") return DeviceType.SWITCH_ENERGY;
    if (deviceTypeKey === "device.thermostat") return DeviceType.THERMOSTAT;
    return null;
  }

  private async toMatterDevice(device: MatterDeviceDiscovered) {
    const id = device.id;
    const nodeId = device.nodeId ?? "0";
    const vendorId = device.vendorId ?? undefined;
    const productId = device.productId ?? undefined;
    const vendorInfo = vendorId != null && productId != null
      ? matterVendors.getVendorAndProductName(vendorId, productId)
      : null;

    // Default-Name aus Vendor/Product ableiten (falls verfügbar), ansonsten discovered Name behalten
    const derivedName =
      vendorInfo?.productName
        ? `${vendorInfo.vendorName} ${vendorInfo.productName}`.trim()
        : (device.name ?? "Matter Device");

    const typeFromVendor = this.toDeviceType(vendorInfo?.deviceType ?? null);

    // Passendes Device instanziieren
    if (typeFromVendor === DeviceType.SWITCH_DIMMER) {
      //get Buttons for Node
      const buttons = await this.deviceController.getButtonsForDevice(device);
      const dimmer = new MatterSwitchDimmer(derivedName, id, nodeId, buttons);
      setMatterDeviceLanIpv4(dimmer, device);
      dimmer.setMatterController(this.deviceController);
      await dimmer.updateValues();
      return dimmer;
    }
    if (typeFromVendor === DeviceType.SWITCH) {
      //get Buttons for Node
      const buttons = await this.deviceController.getButtonsForDevice(device);
      const switchDevice = new MatterSwitch(derivedName, id, nodeId, buttons);
      setMatterDeviceLanIpv4(switchDevice, device);
      switchDevice.setMatterController(this.deviceController);
      await switchDevice.updateValues();
      return switchDevice;
    }
    if (typeFromVendor === DeviceType.SWITCH_ENERGY) {
      //get Buttons for Node
      const buttons = await this.deviceController.getButtonsForDevice(device);
      const switchEnergyDevice = new MatterSwitchEnergy(derivedName, id, nodeId, buttons);
      setMatterDeviceLanIpv4(switchEnergyDevice, device);
      switchEnergyDevice.setMatterController(this.deviceController);
      await switchEnergyDevice.updateValues();
      return switchEnergyDevice;
    }

    if (typeFromVendor === DeviceType.THERMOSTAT) {
      const thermostatDevice = new MatterThermostat(derivedName, id, nodeId);
      setMatterDeviceLanIpv4(thermostatDevice, device);
      thermostatDevice.setMatterController(this.deviceController);
      await thermostatDevice.updateValues();
      return thermostatDevice;
    }

    // Fallback: wenn Vendor/Product unbekannt oder kein Mapping existiert, generisches Device speichern
    const fallback = new Device({
      id,
      name: derivedName,
      moduleId: MATTERCONFIG.id,
      isConnected: true
    });
    setMatterDeviceLanIpv4(fallback, device);
    return fallback;
  }

  async convertDeviceFromDatabase(device: Device): Promise<Device | null> {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }

    const deviceType = device.type as DeviceType;
    let convertedDevice: Device | null = null;

    switch (deviceType) {
      case DeviceType.SWITCH_ENERGY:
        const matterSwitchEnergy = new MatterSwitchEnergy();
        Object.assign(matterSwitchEnergy, device);
        matterSwitchEnergy.rehydrateButtons();
        matterSwitchEnergy.setMatterController(this.deviceController);
        await matterSwitchEnergy.updateValues();
        convertedDevice = matterSwitchEnergy;
        break;
      case DeviceType.SWITCH:
        const matterSwitch = new MatterSwitch();
        Object.assign(matterSwitch, device);
        matterSwitch.rehydrateButtons();
        matterSwitch.setMatterController(this.deviceController);
        await matterSwitch.updateValues();
        convertedDevice = matterSwitch;
        break;
      case DeviceType.SWITCH_DIMMER:
        const matterSwitchDimmer = new MatterSwitchDimmer();
        Object.assign(matterSwitchDimmer, device);
        matterSwitchDimmer.rehydrateButtons();
        matterSwitchDimmer.setMatterController(this.deviceController);
        await matterSwitchDimmer.updateValues();
        convertedDevice = matterSwitchDimmer;
        break;
      case DeviceType.THERMOSTAT:
        const matterThermostat = new MatterThermostat();
        Object.assign(matterThermostat, device);
        matterThermostat.setMatterController(this.deviceController);
        await matterThermostat.updateValues();
        convertedDevice = matterThermostat;
        break;
      case DeviceType.VIRTUAL:
        const virtualDevice = new MatterVirtual();
        Object.assign(virtualDevice, device);
        virtualDevice.setMatterController(this.deviceController);
        await virtualDevice.updateValues();
        convertedDevice = virtualDevice;
        break;
      case DeviceType.SPEECH_ASSISTANT:
        const speechAssistantDevice = new MatterSpeechAssistant();
        Object.assign(speechAssistantDevice, device);
        speechAssistantDevice.setMatterController(this.deviceController);
        await speechAssistantDevice.updateValues();
        convertedDevice = speechAssistantDevice;
        break;
    }

    return convertedDevice;
  }

  async setActive(deviceId: string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    if( device.type === DeviceType.VIRTUAL) {
      await (device as MatterVirtual).setActive(true, true);
      this.deviceManager.saveDevice(device);
      return true;
    }
    if( device.type === DeviceType.SPEECH_ASSISTANT) {
      await (device as MatterSpeechAssistant).setActive(true, true);
      this.deviceManager.saveDevice(device);
      return true;
    }
    return false;
  }

  async setInactive(deviceId: string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    if( device.type === DeviceType.VIRTUAL) {
      await (device as MatterVirtual).setInactive(true, true);
      this.deviceManager.saveDevice(device);
      return true;
    }
    if( device.type === DeviceType.SPEECH_ASSISTANT) {
      await (device as MatterSpeechAssistant).setInactive(true, true);
      this.deviceManager.saveDevice(device);
      return true; 
    }
    return false;
  }

  async toggle(deviceId: string, buttonId:string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    if (device.type === DeviceType.VIRTUAL) {
      const d = device as MatterVirtual;
      if (d.isActive()) {
        await d.setInactive(true, true);
      } else {
        await d.setActive(true, true);
      }
      this.deviceManager.saveDevice(device);
      return true;
    }
    if (device.type === DeviceType.SPEECH_ASSISTANT) {
      const d = device as MatterSpeechAssistant;
      if (d.isActive()) {
        await d.setInactive(true, true);
      } else {
        await d.setActive(true, true);
      }
      this.deviceManager.saveDevice(device);
      return true;
    }
    await ( device as MatterSwitchEnergy | MatterSwitch | MatterSwitchDimmer).toggle(buttonId, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

  async setOn(deviceId: string, buttonId:string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    if (device.type === DeviceType.VIRTUAL) {
      await (device as MatterVirtual).setActive(true, true);
      this.deviceManager.saveDevice(device);
      return true;
    }
    if (device.type === DeviceType.SPEECH_ASSISTANT) {
      await (device as MatterSpeechAssistant).setActive(true, true);
      this.deviceManager.saveDevice(device);
      return true;
    }
    await ( device as MatterSwitchEnergy | MatterSwitch | MatterSwitchDimmer).on(buttonId, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

  async setOff(deviceId: string, buttonId:string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    if (device.type === DeviceType.VIRTUAL) {
      await (device as MatterVirtual).setInactive(true, true);
      this.deviceManager.saveDevice(device);
      return true;
    }
    if (device.type === DeviceType.SPEECH_ASSISTANT) {
      await (device as MatterSpeechAssistant).setInactive(true, true);
      this.deviceManager.saveDevice(device);
      return true;
    }
    await ( device as MatterSwitchEnergy | MatterSwitch | MatterSwitchDimmer).off(buttonId, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

  async setIntensity(deviceId: string, buttonId:string, intensity:number): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    await (device as MatterSwitchDimmer).setBrightness(buttonId, intensity, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

  async setTemperatureGoal(deviceId: string, temperatureGoal:number): Promise<boolean> {
    const bounded = Math.max(15, Math.min(30, temperatureGoal));
    const constraintTemperature = Math.round(bounded * 100) / 100;
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    await ( device as MatterThermostat).setTemperatureGoal(constraintTemperature, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

  async setTemperatureSchedules(deviceId: string, temperatureSchedules:TemperatureSchedule[]): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    await ( device as MatterThermostat).setTemperatureSchedules(temperatureSchedules, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

}

