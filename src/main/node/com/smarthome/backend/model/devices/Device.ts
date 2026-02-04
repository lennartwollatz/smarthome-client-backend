import { DeviceType } from "./helper/DeviceType.js";
import { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceListenerParams } from "./helper/DeviceListenerParams.js";
import { DeviceFunction, stringsToDeviceFunctions } from "../DeviceFunction.js";

export class Device {
  protected triggerListeners: Map<string, DeviceListenerPair[]> = new Map();

  id?: string;
  name?: string;
  room?: string;
  icon?: string;
  type?: DeviceType;
  typeLabel?: string;
  moduleId?: string;
  isConnected?: boolean;
  isConnecting?: boolean;
  isPairingMode?: boolean;
  functionsBool?: DeviceFunction[];
  functionsAction?: DeviceFunction[];
  functionsTrigger?: DeviceFunction[];
  hasBattery = false;
  batteryLevel = 0;
  quickAccess?: boolean;

  constructor(init?: Partial<Device>) {
    Object.assign(this, init);
  }

  private ensureTriggerListenersInitialized() {
    if (!this.triggerListeners) {
      this.triggerListeners = new Map();
    }
  }

  addListener(params: DeviceListenerParams, listener: () => void): void;
  addListener(params: DeviceListenerParams, listenerWithParam: (value: unknown) => void): void;
  addListener(
    params: DeviceListenerParams,
    callback: (() => void) | ((value: unknown) => void)
  ) {
    if (!params || !params.name || !callback) return;
    this.ensureTriggerListenersInitialized();
    const triggerName = params.name;
    const list = this.triggerListeners.get(triggerName) ?? [];
    list.push(new DeviceListenerPair(params, callback as any));
    this.triggerListeners.set(triggerName, list);
  }

  removeListener(key?: string, name?: string) {
    if (!key || !name || !this.triggerListeners) return;
    const list = this.triggerListeners.get(name);
    if (!list) return;
    const filtered = list.filter(listener => listener.getParams()?.key !== key);
    this.triggerListeners.set(name, filtered);
  }

  removeAllListeners() {
    this.ensureTriggerListenersInitialized();
    this.triggerListeners.clear();
  }

  triggerCheckListener(triggerName: string) {
    this.checkListener(triggerName);
  }

  protected checkListener(_triggerName: string) {}

  protected initializeFunctionsBool() {}

  protected initializeFunctionsAction() {}

  protected initializeFunctionsTrigger() {}
}
