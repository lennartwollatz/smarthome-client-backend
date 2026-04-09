import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventSwitchStatusChanged } from "../../server/events/events/EventSwitchStatusChanged.js";
import { EventSwitchPressed } from "../../server/events/events/EventSwitchPressed.js";
import { EventSwitchDoublePressed } from "../../server/events/events/EventSwitchDoublePressed.js";
import { EventSwitchTriplePressed } from "../../server/events/events/EventSwitchTriplePressed.js";
import { EventSwitchButtonOn } from "../../server/events/events/EventSwitchButtonOn.js";
import { EventSwitchButtonOff } from "../../server/events/events/EventSwitchButtonOff.js";
import { EventSwitchEnergyUsageChanged } from "../../server/events/events/EventSwitchEnergyUsageChanged.js";
import { EventSwitchEnergyUsageHigher } from "../../server/events/events/EventSwitchEnergyUsageHigher.js";

/**
 * Interface für EnergyUsage (historische Energieverbrauchsdaten)
 */
export interface EnergyUsage {
  time: number; // Ende des 5-Minuten-Fensters (aktuellster Messzeitpunkt im Slot)
  value: number; // kWh in diesem 5-Minuten-Slot (Summe der Zusammenfassungen)
}

/**
 * Interface für Energy (aktuelle und historische Energieverbrauchsdaten)
 */
export interface Energy {
  now: number; // aktueller Energieverbrauch
  tt: number; // Energieverbrauch start des Tages bis jetzt
  wt: number; // Energieverbrauch start der Woche bis jetzt
  mt: number; // Energieverbrauch Monat bis jetzt
  yt: number; // Energieverbrauch Jahr bis jetzt
}

export abstract class DeviceSwitch extends Device {
    private energyBucketAnchorMs: Record<string, number> = {};
    private static readonly ENERGY_BUCKET_MS = 5 * 60 * 1000;

  public static Button = class Button {
    on: boolean;
    pressCount: number;
    initialPressTime: number;
    lastPressTime: number;
    firstPressTime: number;
    name?: string;
    connectedToLight?: boolean;
    brightness?: number;
    energyUsage: Energy;
    energyUsages: EnergyUsage[];

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
      this.energyUsage = {
        now: 0,
        tt: 0,
        wt: 0,
        mt: 0,
        yt: 0,
      };
      this.energyUsages = [];
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

  abstract delete(): Promise<void>;

  override toDatabaseJson(): Record<string, unknown> {
    const btns: Record<string, Record<string, unknown>> = {};
    for (const [id, btn] of Object.entries(this.buttons ?? {})) {
      btns[id] = {
        o: btn.on ? 1 : 0,
        b: btn.brightness ?? 0,
        eu: btn.energyUsage?.now ?? 0,
        pc: btn.pressCount ?? 0,
        ip: btn.initialPressTime ?? 0,
        lp: btn.lastPressTime ?? 0,
        fp: btn.firstPressTime ?? 0,
      };
    }
    return { ...super.toDatabaseJson(), btns };
  }

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

    if (trigger) {
      this.eventManager?.triggerEvent(new EventSwitchStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSwitchDoublePressed(this.id, deviceBefore, buttonId));
    }
  }

  async triplePress(buttonId: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    const button = this.buttons?.[buttonId];
    if (!button) return;

    const currentTime = Date.now();
    button.pressCount = 3;
    button.firstPressTime = currentTime - 2500;
    button.lastPressTime = currentTime;

    if (trigger) {
      this.eventManager?.triggerEvent(new EventSwitchStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSwitchTriplePressed(this.id, deviceBefore, buttonId));
    }
  }

  async setInitialPressed(buttonId: string) {
    const button = this.buttons?.[buttonId];
    if (!button) return;
    button.setInitialPressTime(Date.now());
  }

  /**
   * Neuen Messpunkt setzen: `energy` ist die aktuelle Wirkleistung in Watt.
   * kWh seit dem letzten Array-Zeitpunkt werden berechnet und in 5-Minuten-Slots zusammengefasst
   * (Merge in das letzte Element, solange das vorletzte Element &lt; 5 Minuten zurückliegt; bei einem Eintrag gilt der Slot-Anker).
   * @param trigger Ob Events ausgelöst werden sollen
   */
  async setEnergyUsage(button:string, energy:number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    const buttonButton = this.buttons[button];
    if(!buttonButton) {
      return;
    }
    buttonButton.energyUsages ??= [];
    const usages = buttonButton.energyUsages;
    const t = Date.now();

    if (usages.length === 0) {
      usages.push({ time: t, value: 0 });
      this.energyBucketAnchorMs[button] = t;
      if (trigger) {
        this.eventManager?.triggerEvent(new EventSwitchEnergyUsageChanged(this.id, deviceBefore, buttonButton.energyUsage!));
        this.eventManager?.triggerEvent(new EventSwitchEnergyUsageHigher(this.id, deviceBefore, buttonButton.energyUsage!));
      }
      return;
    }

    const last = usages[usages.length - 1];
    const intervalStartMs = last.time;
    const dtMs = t - intervalStartMs;
    const incrementKwh =
      dtMs > 0 ? energy * (dtMs / 1000) / 3_600_000 : 0;

    const mergeIntoLast =
      usages.length >= 2
        ? t - usages[usages.length - 2].time < DeviceSwitch.ENERGY_BUCKET_MS
        : t - (this.energyBucketAnchorMs[button] ?? usages[0].time) < DeviceSwitch.ENERGY_BUCKET_MS;

    if (mergeIntoLast) {
      last.value += incrementKwh;
      last.time = t;
    } else {
      this.energyBucketAnchorMs[button] = t;
      usages.push({ time: t, value: incrementKwh });
    }

    if (intervalStartMs < t) {
      this.applyIncrementalEnergyKwh(button, incrementKwh, intervalStartMs, t);
    }

    if (trigger) {
      this.eventManager?.triggerEvent(new EventSwitchEnergyUsageChanged(this.id, deviceBefore, buttonButton.energyUsage!));
      this.eventManager?.triggerEvent(new EventSwitchEnergyUsageHigher(this.id, deviceBefore, buttonButton.energyUsage!));
    }
  }

  /** Wirkung eines Messintervalls auf die Aggregat-Felder (inkl. Periodenwechsel), ohne energyUsages zu lesen. */
  private applyIncrementalEnergyKwh(button: string, incrementKwh: number, fromMs: number, toMs: number): void {
    const buttonButton = this.buttons[button];
    if (!buttonButton?.energyUsage || toMs <= fromMs) {
      return;
    }
    this.resetUsageAccumulatorsIfPeriodAdvanced(button, fromMs, toMs);
    buttonButton.energyUsage.now = incrementKwh;
    buttonButton.energyUsage.tt += incrementKwh;
    buttonButton.energyUsage.wt += incrementKwh;
    buttonButton.energyUsage.mt += incrementKwh;
    buttonButton.energyUsage.yt += incrementKwh;
  }

  private sameLocalDay(aMs: number, bMs: number): boolean {
    const a = new Date(aMs);
    const b = new Date(bMs);
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private sameLocalMonth(aMs: number, bMs: number): boolean {
    const a = new Date(aMs);
    const b = new Date(bMs);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  private sameLocalYear(aMs: number, bMs: number): boolean {
    return new Date(aMs).getFullYear() === new Date(bMs).getFullYear();
  }

  /** Montag 00:00 lokale Zeit (für Wochenvergleich). */
  private startOfLocalWeekMs(tMs: number): number {
    const d = new Date(tMs);
    d.setHours(0, 0, 0, 0);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d.getTime();
  }

  /**
   * Wenn der neue Messpunkt in einer neuen Periode liegt, die betroffenen
   * Akkumulatoren (nur tt / wt / mt / yt) vor dem nächsten Increment zurücksetzen.
   */
  private resetUsageAccumulatorsIfPeriodAdvanced(button:string, prevMs: number, lastMs: number): void {
    if (lastMs <= prevMs) {
      return;
    }
    const buttonButton = this.buttons[button];
    if(!buttonButton || !buttonButton.energyUsage) {
      return;
    }
    if (!this.sameLocalYear(prevMs, lastMs)) {
      buttonButton.energyUsage!.yt = 0;
      buttonButton.energyUsage!.mt = 0;
      buttonButton.energyUsage!.wt = 0;
      buttonButton.energyUsage!.tt = 0;
      return;
    }
    if (!this.sameLocalMonth(prevMs, lastMs)) {
      buttonButton.energyUsage!.mt = 0;
      buttonButton.energyUsage!.wt = 0;
      buttonButton.energyUsage!.tt = 0;
      return;
    }
    if (this.startOfLocalWeekMs(prevMs) !== this.startOfLocalWeekMs(lastMs)) {
      buttonButton.energyUsage!.wt = 0;
      buttonButton.energyUsage!.tt = 0;
      return;
    }
    if (!this.sameLocalDay(prevMs, lastMs)) {
      buttonButton.energyUsage!.tt = 0;
    }
  }

}

export type Button = InstanceType<typeof DeviceSwitch.Button>;
