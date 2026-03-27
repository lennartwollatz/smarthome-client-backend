import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventSwitchStatusChanged } from "../../server/events/events/EventSwitchStatusChanged.js";
import { EventSwitchPressed } from "../../server/events/events/EventSwitchPressed.js";
import { EventSwitchDoublePressed } from "../../server/events/events/EventSwitchDoublePressed.js";
import { EventSwitchTriplePressed } from "../../server/events/events/EventSwitchTriplePressed.js";
import { EventSwitchButtonOn } from "../../server/events/events/EventSwitchButtonOn.js";
import { EventSwitchButtonOff } from "../../server/events/events/EventSwitchButtonOff.js";
import { EventSwitchLongPressed } from "../../server/events/events/EventSwitchLongPressed.js";

export abstract class DeviceSwitch extends Device {
  

  public static Button = class Button {
    on: boolean;
    pressCount: number;
    initialPressTime: number;
    lastPressTime: number;
    firstPressTime: number;
    name?: string;
    connectedToLight?: boolean;
    brightness?: number;

    constructor(
      on = false,
      pressCount = 0,
      initialPressTime = 0,
      lastPressTime = 0,
      firstPressTime = 0,
      name?: string,
      connectedToLight?: boolean,
      brightness?: number
    ) {
      this.on = on;
      this.pressCount = pressCount;
      this.initialPressTime = initialPressTime;
      this.lastPressTime = lastPressTime;
      this.firstPressTime = firstPressTime;
      this.name = name;
      this.connectedToLight = connectedToLight;
      this.brightness = brightness;
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

    getBrightness() {
      return this.brightness;
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

    setBrightness(brightness: number) {
      this.brightness = brightness;
    }
  };

  buttons: Record<string, InstanceType<typeof DeviceSwitch.Button>> = {};

  constructor(init?: Partial<DeviceSwitch>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.SWITCH;
    this.buttons ??= {};
    this.rehydrateButtons();
  }

  abstract updateValues(): Promise<void>;


  addButton(buttonId: string) {
    this.buttons ??= {};
    this.buttons[buttonId] = new DeviceSwitch.Button();
  }

  public rehydrateButtons() {
    this.buttons ??= {};
    const rehydratedButtons: Record<string, InstanceType<typeof DeviceSwitch.Button>> = {};
    for (const [buttonId, rawButton] of Object.entries(this.buttons)) {
      if (rawButton instanceof DeviceSwitch.Button) {
        rehydratedButtons[buttonId] = rawButton;
        continue;
      }
      const button = rawButton as Partial<Button> | undefined;
      rehydratedButtons[buttonId] = new DeviceSwitch.Button(
        button?.on ?? false,
        button?.pressCount ?? 0,
        button?.initialPressTime ?? 0,
        button?.lastPressTime ?? 0,
        button?.firstPressTime ?? 0,
        button?.name,
        button?.connectedToLight ?? false,
        button?.brightness ?? button?.on ? 100 : 0
      );
    }
    this.buttons = rehydratedButtons;
  }

  getButton(buttonId: string): Button | undefined {
    return this.buttons[buttonId];
  }

  private triggerSwitchEvents(buttonId: string, trigger: boolean, deviceBefore: DeviceSwitch) {
    if (!trigger) return;
    const button = this.buttons?.[buttonId];
    if (!button) return;

    this.eventManager?.triggerEvent(new EventSwitchStatusChanged(this.id, deviceBefore, { ...this }));
    this.eventManager?.triggerEvent(new EventSwitchPressed(this.id, deviceBefore, buttonId, button.getPressCount()));

    if (button.getPressCount() === 2) {
      this.eventManager?.triggerEvent(new EventSwitchDoublePressed(this.id, deviceBefore, buttonId));
    }
    if (button.getPressCount() === 3) {
      this.eventManager?.triggerEvent(new EventSwitchTriplePressed(this.id, deviceBefore, buttonId));
    }
    if (button.isOn()) {
      this.eventManager?.triggerEvent(new EventSwitchButtonOn(this.id, deviceBefore, buttonId));
    } else {
      this.eventManager?.triggerEvent(new EventSwitchButtonOff(this.id, deviceBefore, buttonId));
    }
  }

  isOn(buttonId: string) {
    return this.buttons?.[buttonId]?.isOn() ?? false;
  }
  isOff(buttonId: string) {
    return !this.isOn(buttonId);
  }

  async on(buttonId: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
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
    button.setOn(true);
    if (execute) {
      await this.executeSetOn(buttonId);
    }
    this.triggerSwitchEvents(buttonId, trigger, deviceBefore);
  }

  protected abstract executeSetOn(buttonId: string): Promise<void>;

  async off(buttonId: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
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
    button.setOn(false);
    if (execute) {
      await this.executeSetOff(buttonId);
    }
    this.triggerSwitchEvents(buttonId, trigger, deviceBefore);
  }

  protected abstract executeSetOff(buttonId: string): Promise<void>;

  async toggle(buttonId: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
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
      await this.executeToggle(buttonId);
    }
    this.triggerSwitchEvents(buttonId, trigger, deviceBefore);
  }

  protected abstract executeToggle(buttonId: string): Promise<void>;

  async doublePress(buttonId: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    const button = this.buttons?.[buttonId];
    if (!button) return;

    const currentTime = Date.now();
    button.pressCount = 2;
    button.firstPressTime = currentTime - 2500;
    button.lastPressTime = currentTime;

    if (execute) {
      await this.executeDoublePress(buttonId);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSwitchStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSwitchDoublePressed(this.id, deviceBefore, buttonId));
    }
  }

  protected abstract executeDoublePress(buttonId: string): Promise<void>;

  async triplePress(buttonId: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    const button = this.buttons?.[buttonId];
    if (!button) return;

    const currentTime = Date.now();
    button.pressCount = 3;
    button.firstPressTime = currentTime - 2500;
    button.lastPressTime = currentTime;

    if (execute) {
      await this.executeTriplePress(buttonId);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSwitchStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSwitchTriplePressed(this.id, deviceBefore, buttonId));
    }
  }

  protected abstract executeTriplePress(buttonId: string): Promise<void>;

  async setInitialPressed(buttonId: string) {
    const button = this.buttons?.[buttonId];
    if (!button) return;
    button.setInitialPressTime(Date.now());
  }

}

export type Button = InstanceType<typeof DeviceSwitch.Button>;
