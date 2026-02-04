import { logger } from "../../../logger.js";
import { DeviceListenerParams } from "./DeviceListenerParams.js";

export class DeviceListenerPair {
  private params?: DeviceListenerParams;
  private listener?: () => void;
  private listenerWithParam?: (value: unknown) => void;

  constructor(params: DeviceListenerParams, listener: () => void);
  constructor(params: DeviceListenerParams, listenerWithParam: (value: unknown) => void);
  constructor(params: DeviceListenerParams, callback: (() => void) | ((value: unknown) => void)) {
    this.params = params;
    if (callback.length === 0) {
      this.listener = callback as () => void;
    } else {
      this.listenerWithParam = callback as (value: unknown) => void;
    }
  }

  getParams() {
    return this.params;
  }

  run() {
    const actionId = this.params?.key ?? "unbekannt";
    const triggerName = this.params?.name ?? "unbekannt";
    logger.info({ actionId, triggerName }, "Listener ausgefuehrt");
    if (this.listener) {
      this.listener();
    } else if (this.listenerWithParam) {
      this.listenerWithParam(null);
    }
  }

  runWithValue(value: unknown) {
    const actionId = this.params?.key ?? "unbekannt";
    const triggerName = this.params?.name ?? "unbekannt";
    logger.info({ actionId, triggerName, value }, "Listener ausgefuehrt (mit Wert)");
    if (this.listenerWithParam) {
      this.listenerWithParam(value);
    } else if (this.listener) {
      this.listener();
    }
  }
}

