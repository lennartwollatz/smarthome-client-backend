import { Device } from "./Device.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceType } from "./helper/DeviceType.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceSwitch extends Device {
  static TriggerFunctionName = {
    ON_PRESSED: "onPressed",
    ON_PRESSED_INT: "onPressed(int)",
    ON_DOUBLE_PRESSED: "onDoublePressed",
    ON_DOUBLE_PRESSED_INT: "onDoublePressed(int)",
    ON_TRIPLE_PRESSED: "onTriplePressed",
    ON_TRIPLE_PRESSED_INT: "onTriplePressed(int)",
    ON_BUTTON_ON_INT: "onButtonOn(int)",
    ON_BUTTON_OFF_INT: "onButtonOff(int)"
  } as const;

  static ActionFunctionName = {
    TOGGLE: "toggle(int)",
    DOUBLE_PRESS: "doublePress(int)",
    TRIPLE_PRESS: "triplePress(int)"
  } as const;

  static BoolFunctionName = {
    ON_INT: "on(int)",
    OFF_INT: "off(int)"
  } as const;

  protected static Button = class Button {
    on: boolean;
    pressCount: number;
    initialPressTime: number;
    lastPressTime: number;
    firstPressTime: number;
    name?: string;

    constructor(
      on = false,
      pressCount = 0,
      initialPressTime = 0,
      lastPressTime = 0,
      firstPressTime = 0,
      name?: string
    ) {
      this.on = on;
      this.pressCount = pressCount;
      this.initialPressTime = initialPressTime;
      this.lastPressTime = lastPressTime;
      this.firstPressTime = firstPressTime;
      this.name = name;
    }

    isOn() {
      return this.on;
    }

    getPressCount() {
      return this.pressCount;
    }

    getLastPressTime() {
      return this.lastPressTime;
    }

    getFirstPressTime() {
      return this.firstPressTime;
    }

    getInitialPressTime() {
      return this.initialPressTime;
    }

    setInitialPressTime(initialPressTime: number) {
      this.initialPressTime = initialPressTime;
    }

    setFirstPressTime(firstPressTime: number) {
      this.firstPressTime = firstPressTime;
    }

    setPressCount(pressCount: number) {
      this.pressCount = pressCount;
    }

    setOn(on: boolean) {
      this.on = on;
    }

    setLastPressTime(lastPressTime: number) {
      this.lastPressTime = lastPressTime;
    }
  };

  buttons: Record<string, InstanceType<typeof DeviceSwitch.Button>> = {};

  constructor(init?: Partial<DeviceSwitch>) {
    super();
    Object.assign(this, init);
    this.type = DeviceType.SWITCH;
    this.icon = "🔌";
    this.typeLabel = "deviceType.switch";
    this.buttons ??= {};
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  abstract updateValues(): Promise<void>;

  addButton(buttonId: string) {
    this.buttons ??= {};
    this.buttons[buttonId] = new DeviceSwitch.Button();
  }

  protected override initializeFunctionsBool() {
    this.functionsBool = [
      DeviceFunction.fromString(DeviceSwitch.BoolFunctionName.ON_INT, 'bool'),
      DeviceFunction.fromString(DeviceSwitch.BoolFunctionName.OFF_INT, 'bool')
    ];
  }

  protected override initializeFunctionsAction() {
    this.functionsAction = [
      DeviceFunction.fromString(DeviceSwitch.ActionFunctionName.TOGGLE, 'void'),
      DeviceFunction.fromString(DeviceSwitch.ActionFunctionName.DOUBLE_PRESS, 'void'),
      DeviceFunction.fromString(DeviceSwitch.ActionFunctionName.TRIPLE_PRESS, 'void')
    ];
  }

  protected override initializeFunctionsTrigger() {
    this.functionsTrigger = [
      DeviceFunction.fromString(DeviceSwitch.TriggerFunctionName.ON_PRESSED, 'void'),
      DeviceFunction.fromString(DeviceSwitch.TriggerFunctionName.ON_PRESSED_INT, 'void'),
      DeviceFunction.fromString(DeviceSwitch.TriggerFunctionName.ON_DOUBLE_PRESSED, 'void'),
      DeviceFunction.fromString(DeviceSwitch.TriggerFunctionName.ON_DOUBLE_PRESSED_INT, 'void'),
      DeviceFunction.fromString(DeviceSwitch.TriggerFunctionName.ON_TRIPLE_PRESSED, 'void'),
      DeviceFunction.fromString(DeviceSwitch.TriggerFunctionName.ON_TRIPLE_PRESSED_INT, 'void'),
      DeviceFunction.fromString(DeviceSwitch.TriggerFunctionName.ON_BUTTON_ON_INT, 'void'),
      DeviceFunction.fromString(DeviceSwitch.TriggerFunctionName.ON_BUTTON_OFF_INT, 'void')
    ];
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceSwitch.TriggerFunctionName).includes(
      triggerName as (typeof DeviceSwitch.TriggerFunctionName)[keyof typeof DeviceSwitch.TriggerFunctionName]
    );
    if (!isValid) return;
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceSwitch.TriggerFunctionName.ON_DOUBLE_PRESSED) {
      const hasDoublePress = Object.values(this.buttons ?? {}).some(button => button.getPressCount() === 2);
      if (!hasDoublePress) return;
    } else if (triggerName === DeviceSwitch.TriggerFunctionName.ON_TRIPLE_PRESSED) {
      const hasTriplePress = Object.values(this.buttons ?? {}).some(button => button.getPressCount() === 3);
      if (!hasTriplePress) return;
    }

    if (
      triggerName === DeviceSwitch.TriggerFunctionName.ON_DOUBLE_PRESSED ||
      triggerName === DeviceSwitch.TriggerFunctionName.ON_TRIPLE_PRESSED ||
      triggerName === DeviceSwitch.TriggerFunctionName.ON_PRESSED
    ) {
      listeners.forEach(listener => listener.run());
    }
  }

  private checkListenerForButton(triggerName: string, buttonId: string) {
    if (!triggerName) return;
    const isValid = Object.values(DeviceSwitch.TriggerFunctionName).includes(
      triggerName as (typeof DeviceSwitch.TriggerFunctionName)[keyof typeof DeviceSwitch.TriggerFunctionName]
    );
    if (!isValid) return;
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    const button = this.buttons?.[buttonId];
    if (
      triggerName === DeviceSwitch.TriggerFunctionName.ON_DOUBLE_PRESSED_INT &&
      (!button || button.getPressCount() !== 2)
    ) {
      return;
    }
    if (
      triggerName === DeviceSwitch.TriggerFunctionName.ON_TRIPLE_PRESSED_INT &&
      (!button || button.getPressCount() !== 3)
    ) {
      return;
    }
    if (
      triggerName === DeviceSwitch.TriggerFunctionName.ON_BUTTON_ON_INT &&
      (!button || !button.isOn())
    ) {
      return;
    }
    if (
      triggerName === DeviceSwitch.TriggerFunctionName.ON_BUTTON_OFF_INT &&
      (!button || button.isOn())
    ) {
      return;
    }

    const shouldRun = (pair: DeviceListenerPair) => {
      const listenerParam = pair.getParams()?.getParam1AsString();
      return listenerParam != null && listenerParam === buttonId;
    };

    if (
      triggerName === DeviceSwitch.TriggerFunctionName.ON_DOUBLE_PRESSED_INT ||
      triggerName === DeviceSwitch.TriggerFunctionName.ON_TRIPLE_PRESSED_INT ||
      triggerName === DeviceSwitch.TriggerFunctionName.ON_PRESSED_INT ||
      triggerName === DeviceSwitch.TriggerFunctionName.ON_BUTTON_ON_INT ||
      triggerName === DeviceSwitch.TriggerFunctionName.ON_BUTTON_OFF_INT
    ) {
      listeners.filter(shouldRun).forEach(listener => listener.run());
    }
  }

  on(buttonId: string) {
    const button = this.buttons?.[buttonId];
    return button != null && button.isOn();
  }

  off(buttonId: string) {
    return !this.on(buttonId);
  }

  toggle(buttonId: string, execute: boolean) {
    const button = this.buttons?.[buttonId];
    if (!button) return;

    const currentTime = Date.now();
    if (button.getFirstPressTime() === 0 || currentTime - button.getFirstPressTime() > 2500) {
      button.setPressCount(1);
      button.setFirstPressTime(currentTime);
      button.setLastPressTime(currentTime);
    } else {
      button.setPressCount(button.getPressCount() + 1);
      button.setLastPressTime(currentTime);
    }

    button.setOn(!button.isOn());

    if (execute) {
      this.executeToggle(buttonId);
    }
    this.checkListener(DeviceSwitch.TriggerFunctionName.ON_PRESSED);
    this.checkListenerForButton(DeviceSwitch.TriggerFunctionName.ON_PRESSED_INT, buttonId);
    this.checkListener(DeviceSwitch.TriggerFunctionName.ON_DOUBLE_PRESSED);
    this.checkListenerForButton(DeviceSwitch.TriggerFunctionName.ON_DOUBLE_PRESSED_INT, buttonId);
    this.checkListener(DeviceSwitch.TriggerFunctionName.ON_TRIPLE_PRESSED);
    this.checkListenerForButton(DeviceSwitch.TriggerFunctionName.ON_TRIPLE_PRESSED_INT, buttonId);

    if (button.isOn()) {
      this.checkListenerForButton(DeviceSwitch.TriggerFunctionName.ON_BUTTON_ON_INT, buttonId);
    } else {
      this.checkListenerForButton(DeviceSwitch.TriggerFunctionName.ON_BUTTON_OFF_INT, buttonId);
    }
  }

  protected abstract executeToggle(buttonId: string): void;

  doublePress(buttonId: string, execute: boolean) {
    const button = this.buttons?.[buttonId];
    if (!button) return;

    const currentTime = Date.now();
    button.pressCount = 2;
    button.firstPressTime = currentTime - 2500;
    button.lastPressTime = currentTime;

    if (execute) {
      this.executeDoublePress(buttonId);
    }
    this.checkListener(DeviceSwitch.TriggerFunctionName.ON_DOUBLE_PRESSED);
    this.checkListenerForButton(DeviceSwitch.TriggerFunctionName.ON_DOUBLE_PRESSED_INT, buttonId);
  }

  protected abstract executeDoublePress(buttonId: string): void;

  triplePress(buttonId: string, execute: boolean) {
    const button = this.buttons?.[buttonId];
    if (!button) return;

    const currentTime = Date.now();
    button.pressCount = 2;
    button.firstPressTime = currentTime - 2500;
    button.lastPressTime = currentTime;

    if (execute) {
      this.executeTriplePress(buttonId);
    }
    this.checkListener(DeviceSwitch.TriggerFunctionName.ON_TRIPLE_PRESSED);
    this.checkListenerForButton(DeviceSwitch.TriggerFunctionName.ON_TRIPLE_PRESSED_INT, buttonId);
  }

  protected abstract executeTriplePress(buttonId: string): void;

  setInitialPressed(buttonId: string) {
    const button = this.buttons?.[buttonId];
    if (!button) return;
    button.setInitialPressTime(Date.now());
  }

  setLongPressed(buttonId: string, execute: boolean) {
    const button = this.buttons?.[buttonId];
    if (!button) return;

    const now = Date.now();
    button.setLastPressTime(now);
    const durationMs = now - button.getFirstPressTime();
    const reductionFactor = Math.min(1.0, durationMs / 5000.0);
    let intensity = Math.round(100.0 * (1.0 - reductionFactor));
    intensity = Math.max(0, Math.min(100, intensity));
    button.setFirstPressTime(now);
    button.setInitialPressTime(now);
    button.setPressCount(0);

    if (execute) {
      this.executeSetBrightness(buttonId, intensity);
    }
  }

  protected abstract executeSetBrightness(buttonId: string, intensity: number): void;
}
