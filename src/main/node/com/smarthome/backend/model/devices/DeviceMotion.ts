import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceMotion extends Device {
  static TriggerFunctionName = {
    SENSIBILITY_CHANGED: "sensibilityChanged",
    MOTION_DETECTED: "motionDetected",
    NO_MOTION_DETECTED: "noMotionDetected",
    MOTION_DETECTED_SINCE: "motionDetectedSince(int)",
    NO_MOTION_DETECTED_SINCE: "noMotionDetectedSince(int)"
  } as const;

  static ActionFunctionName = {
    SET_SENSIBILITY: "setSensibility(int)"
  } as const;

  static BoolFunctionName = {
    MOTION: "motion",
    NO_MOTION: "noMotion",
    MOTION_SINCE: "motionSince(int)",
    NO_MOTION_SINCE: "noMotionSince(int)"
  } as const;

  sensitivity?: number;
  motion?: boolean;
  // Feldname mit Unterstrich für Frontend-Kompatibilität
  motion_last_detect?: string;
  private periodicCheckTasks: Map<string, NodeJS.Timeout> = new Map();

  constructor(init?: Partial<DeviceMotion>) {
    super();
    Object.assign(this, init);
    this.type = DeviceType.MOTION;
    this.icon = "&#128064;";
    this.typeLabel = "deviceType.motion";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  abstract updateValues(): void;

  override removeListener(key?: string, name?: string) {
    if (key) {
      const task = this.periodicCheckTasks.get(key);
      if (task) {
        clearTimeout(task);
        this.periodicCheckTasks.delete(key);
      }
    }
    super.removeListener(key, name);
  }

  protected override initializeFunctionsBool() {
    this.functionsBool = [
      DeviceFunction.fromString(DeviceMotion.BoolFunctionName.MOTION, 'bool'),
      DeviceFunction.fromString(DeviceMotion.BoolFunctionName.NO_MOTION, 'bool'),
      DeviceFunction.fromString(DeviceMotion.BoolFunctionName.MOTION_SINCE, 'bool'),
      DeviceFunction.fromString(DeviceMotion.BoolFunctionName.NO_MOTION_SINCE, 'bool')
    ];
  }

  protected override initializeFunctionsAction() {
    this.functionsAction = [DeviceFunction.fromString(DeviceMotion.ActionFunctionName.SET_SENSIBILITY, 'void')];
  }

  protected override initializeFunctionsTrigger() {
    this.functionsTrigger = [
      DeviceFunction.fromString(DeviceMotion.TriggerFunctionName.SENSIBILITY_CHANGED, 'void'),
      DeviceFunction.fromString(DeviceMotion.TriggerFunctionName.MOTION_DETECTED, 'void'),
      DeviceFunction.fromString(DeviceMotion.TriggerFunctionName.NO_MOTION_DETECTED, 'void'),
      DeviceFunction.fromString(DeviceMotion.TriggerFunctionName.MOTION_DETECTED_SINCE, 'void'),
      DeviceFunction.fromString(DeviceMotion.TriggerFunctionName.NO_MOTION_DETECTED_SINCE, 'void')
    ];
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceMotion.TriggerFunctionName).includes(
      triggerName as (typeof DeviceMotion.TriggerFunctionName)[keyof typeof DeviceMotion.TriggerFunctionName]
    );
    if (!isValid) return;
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceMotion.TriggerFunctionName.SENSIBILITY_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceMotion.TriggerFunctionName.MOTION_DETECTED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceMotion.TriggerFunctionName.NO_MOTION_DETECTED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceMotion.TriggerFunctionName.MOTION_DETECTED_SINCE) {
      listeners.forEach(pair =>
        this.setupPeriodicCheckIfNeeded(pair, DeviceMotion.TriggerFunctionName.MOTION_DETECTED_SINCE)
      );
    }
    if (triggerName === DeviceMotion.TriggerFunctionName.NO_MOTION_DETECTED_SINCE) {
      listeners.forEach(pair =>
        this.setupPeriodicCheckIfNeeded(pair, DeviceMotion.TriggerFunctionName.NO_MOTION_DETECTED_SINCE)
      );
    }
  }

  private setupPeriodicCheckIfNeeded(pair: DeviceListenerPair, triggerName: string) {
    const listenerKey = pair.getParams()?.key;
    if (!listenerKey) return;
    const existingTask = this.periodicCheckTasks.get(listenerKey);
    if (existingTask) {
      clearTimeout(existingTask);
      this.periodicCheckTasks.delete(listenerKey);
    }

    const seconds = pair.getParams()?.getParam1AsInt();
    if (!seconds || seconds <= 0) return;

    const remainingSeconds = this.calculateRemainingSeconds(seconds);
    if (remainingSeconds <= 0) {
      pair.run();
      return;
    }

    const checkTask = () => {
      let conditionMet = false;
      if (triggerName === DeviceMotion.TriggerFunctionName.MOTION_DETECTED_SINCE) {
        conditionMet = this.isMotionDetectedSince(seconds);
      } else if (triggerName === DeviceMotion.TriggerFunctionName.NO_MOTION_DETECTED_SINCE) {
        conditionMet = this.isNoMotionDetectedSince(seconds);
      }
      if (conditionMet) {
        pair.run();
        const task = this.periodicCheckTasks.get(listenerKey);
        if (task) {
          clearTimeout(task);
          this.periodicCheckTasks.delete(listenerKey);
        }
      } else {
        this.setupPeriodicCheckIfNeeded(pair, triggerName);
      }
    };

    const timeout = setTimeout(checkTask, remainingSeconds * 1000);
    this.periodicCheckTasks.set(listenerKey, timeout);
  }

  private calculateRemainingSeconds(seconds: number) {
    if (!this.motion_last_detect) {
      return seconds + 1;
    }
    const lastDetectTime = this.parseLastDetect();
    if (lastDetectTime === -1) return seconds + 1;
    const currentTime = Date.now();
    const elapsedSeconds = Math.floor((currentTime - lastDetectTime) / 1000);
    const remaining = seconds - elapsedSeconds;
    if (remaining < 0) return -1;
    return remaining + 1;
  }

  private parseLastDetect() {
    if (!this.motion_last_detect) return -1;
    if (/^\d+$/.test(this.motion_last_detect)) {
      return Number(this.motion_last_detect);
    }
    const parsed = Date.parse(this.motion_last_detect);
    return Number.isNaN(parsed) ? -1 : parsed;
  }

  motionActive() {
    return this.motion === true;
  }

  noMotion() {
    return !this.motionActive();
  }

  motionSince(seconds: number) {
    return this.isMotionDetectedSince(seconds);
  }

  noMotionSince(seconds: number) {
    return this.isNoMotionDetectedSince(seconds);
  }

  protected isMotionDetectedSince(seconds: number) {
    if (!this.motion_last_detect) return false;
    const lastDetectTime = this.parseLastDetect();
    if (lastDetectTime === -1) return false;
    const diffSeconds = Math.floor((Date.now() - lastDetectTime) / 1000);
    return diffSeconds >= seconds;
  }

  protected isNoMotionDetectedSince(seconds: number) {
    if (!this.motion_last_detect) return true;
    const lastDetectTime = this.parseLastDetect();
    if (lastDetectTime === -1) return true;
    const diffSeconds = Math.floor((Date.now() - lastDetectTime) / 1000);
    return diffSeconds >= seconds;
  }

  setSensibility(sensitivity: number, execute: boolean) {
    this.sensitivity = sensitivity;
    if (execute) {
      this.executeSetSensibility(sensitivity);
    }
    this.checkListener(DeviceMotion.TriggerFunctionName.SENSIBILITY_CHANGED);
  }

  protected abstract executeSetSensibility(sensitivity: number): void;

  setMotion(motion: boolean, motion_last_detect: string, execute: boolean) {
    this.motion = motion;
    if (motion) {
      this.motion_last_detect = motion_last_detect;
    }
    if (execute) {
      this.executeSetMotion(motion, motion_last_detect);
    }
    if (motion) {
      this.checkListener(DeviceMotion.TriggerFunctionName.MOTION_DETECTED);
    } else {
      this.checkListener(DeviceMotion.TriggerFunctionName.NO_MOTION_DETECTED);
    }
    this.checkListener(DeviceMotion.TriggerFunctionName.MOTION_DETECTED_SINCE);
    this.checkListener(DeviceMotion.TriggerFunctionName.NO_MOTION_DETECTED_SINCE);
  }

  protected abstract executeSetMotion(motion: boolean, motion_last_detect: string): void;
}
