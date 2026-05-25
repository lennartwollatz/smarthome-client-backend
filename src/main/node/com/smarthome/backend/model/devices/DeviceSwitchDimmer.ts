import { DeviceSwitch } from "./DeviceSwitch.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventSwitchStatusChanged } from "../../server/events/events/EventSwitchStatusChanged.js";
import { EventSwitchBrightnessChanged } from "../../server/events/events/EventSwitchBrightnessChanged.js";
import { EventSwitchBrightnessEquals } from "../../server/events/events/EventSwitchBrightnessEquals.js";
import { EventSwitchBrightnessLess } from "../../server/events/events/EventSwitchBrightnessLess.js";
import { EventSwitchBrightnessGreater } from "../../server/events/events/EventSwitchBrightnessGreater.js";
import { EventSwitchLongPressed } from "../../server/events/events/EventSwitchLongPressed.js";
import { EventSwitchPressedLongerThan } from "../../server/events/events/EventSwitchPressedLongerThan.js";

/** Begrenzt die Anzahl der Helligkeits-Updates pro Fade (langsame Faden bleiben sanft). */
const MAX_FADE_STEPS = 100;
/** Mindestabstand zwischen zwei Fade-Updates (Schutz gegen Bus-Last). */
const MIN_FADE_INTERVAL_MS = 500;

/**
 * Aktive Fade-Timer pro Geraet — pro Button getrennt, damit mehrere Buttons
 * eines Schalters parallel faden koennen. WeakMap, damit nichts in toJSON landet.
 */
const FADE_TIMERS = new WeakMap<DeviceSwitchDimmer, Map<string, NodeJS.Timeout>>();

/**
 * Resolver der Fade-Promises pro Geraet+Button. Wird beim Abschluss oder
 * vorzeitigem Abbruch aufgerufen, damit das `await fadeBrightness(...)` im
 * Workflow zuverlaessig zurueckkehrt.
 */
const FADE_RESOLVERS = new WeakMap<DeviceSwitchDimmer, Map<string, () => void>>();

function getFadeTimers(device: DeviceSwitchDimmer): Map<string, NodeJS.Timeout> {
  let map = FADE_TIMERS.get(device);
  if (!map) {
    map = new Map<string, NodeJS.Timeout>();
    FADE_TIMERS.set(device, map);
  }
  return map;
}

function getFadeResolvers(device: DeviceSwitchDimmer): Map<string, () => void> {
  let map = FADE_RESOLVERS.get(device);
  if (!map) {
    map = new Map<string, () => void>();
    FADE_RESOLVERS.set(device, map);
  }
  return map;
}

function clampBrightness(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Berechnet Anzahl Schritte und Intervall fuer einen Fade. Siehe Hinweise in
 * `DeviceLightDimmer.computeFadeSchedule` — bewusst dupliziert, weil die
 * Konstanten geraetespezifisch sein koennen.
 */
function computeFadeSchedule(durationSeconds: number, delta: number): { steps: number; intervalMs: number } {
  const naturalSteps = Math.max(1, Math.min(MAX_FADE_STEPS, Math.abs(delta)));
  const naturalIntervalMs = (durationSeconds * 1000) / naturalSteps;
  if (naturalIntervalMs >= MIN_FADE_INTERVAL_MS) {
    return { steps: naturalSteps, intervalMs: Math.round(naturalIntervalMs) };
  }
  const fittedSteps = Math.max(1, Math.floor((durationSeconds * 1000) / MIN_FADE_INTERVAL_MS));
  return { steps: fittedSteps, intervalMs: MIN_FADE_INTERVAL_MS };
}

export abstract class DeviceSwitchDimmer extends DeviceSwitch {

  constructor(init?: Partial<DeviceSwitchDimmer>) {
    super();
    this.assignInit(init as any);
    this.buttons ??= {};
    this.type = DeviceType.SWITCH_DIMMER;
  }

  isBrightnessEquals(buttonId: string, brightness: number): boolean {
    return (this.buttons?.[buttonId]?.getBrightness() ?? 0) === brightness;
  }
  isBrightnessLess(buttonId: string, brightness: number): boolean {
    return (this.buttons?.[buttonId]?.getBrightness() ?? 0) < brightness;
  }
  isBrightnessGreater(buttonId: string, brightness: number): boolean {
    return (this.buttons?.[buttonId]?.getBrightness() ?? 0) > brightness;
  }

  async setLongPressed(buttonId: string, execute: boolean, trigger: boolean) {
    const deviceBefore = { ...this };
    const button = this.buttons?.[buttonId];
    if (!button) return;

    const now = Date.now();
    button.setLastPressTime(now);
    const durationMs = now - button.getFirstPressTime();
    const reductionFactor = Math.min(1.0, durationMs / 5000.0);
    let brightness = Math.round(100.0 * (1.0 - reductionFactor));
    brightness = Math.max(0, Math.min(100, brightness));
    button.setFirstPressTime(now);
    button.setInitialPressTime(now);
    button.setPressCount(0);
    button.setBrightness(brightness);

    if (execute) {
      await this.executeSetBrightness(buttonId, brightness);
    }

    if(trigger){
      this.eventManager?.triggerEvent(new EventSwitchStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSwitchLongPressed(this.id, deviceBefore, buttonId));
      this.eventManager?.triggerEvent(new EventSwitchPressedLongerThan(this.id, deviceBefore, buttonId, durationMs));
    }
  }


  async setBrightness(buttonId: string, brightness: number, execute: boolean, trigger: boolean = true) {
    this.cancelBrightnessFade(buttonId);
    const deviceBefore = { ...this };
    const button = this.buttons?.[buttonId];
    if (!button) return;
    button.setBrightness(brightness);
    if (brightness > 0) {
      button.setOn(true);
    } else if (brightness === 0) {
      button.setOn(false);
    }
    if (execute) {
      await this.executeSetBrightness(buttonId, brightness);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSwitchStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSwitchBrightnessChanged(this.id, deviceBefore, buttonId, brightness));
      this.eventManager?.triggerEvent(new EventSwitchBrightnessEquals(this.id, deviceBefore, buttonId, brightness));
      this.eventManager?.triggerEvent(new EventSwitchBrightnessLess(this.id, deviceBefore, buttonId, brightness));
      this.eventManager?.triggerEvent(new EventSwitchBrightnessGreater(this.id, deviceBefore, buttonId, brightness));
    }
  }

  /**
   * Faded die Helligkeit eines Buttons ueber `durationSeconds` von `startBrightness`
   * auf `endBrightness`. Setzt sofort den Startwert und plant N-1 weitere Updates
   * in gleichmaessigen Schritten. Ein laufender Fade fuer denselben Button wird
   * vorher abgebrochen; ein direkter `setBrightness`-Aufruf auf demselben Button
   * bricht den Fade ebenfalls ab.
   *
   * Wichtig: Der Aufruf wartet, bis der Fade abgeschlossen ist oder durch einen
   * anderen `setBrightness`/`fadeBrightness`-Aufruf abgebrochen wurde. Der
   * Workflow geht erst danach zum naechsten Schritt/Node ueber.
   */
  async fadeBrightness(
    buttonId: string,
    startBrightness: number,
    endBrightness: number,
    durationSeconds: number,
    execute: boolean = true,
    trigger: boolean = true
  ): Promise<void> {
    if (!this.buttons?.[buttonId]) return;
    const start = clampBrightness(startBrightness);
    const end = clampBrightness(endBrightness);
    const duration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0;

    this.cancelBrightnessFade(buttonId);
    await this.setBrightness(buttonId, start, execute, trigger);

    if (duration <= 0 || start === end) {
      if (start !== end) {
        await this.setBrightness(buttonId, end, execute, trigger);
      }
      return;
    }

    const delta = end - start;
    const { steps, intervalMs } = computeFadeSchedule(duration, delta);

    return new Promise<void>((resolve) => {
      const timers = getFadeTimers(this);
      const resolvers = getFadeResolvers(this);
      const finish = () => {
        timers.delete(buttonId);
        if (resolvers.get(buttonId) === finish) {
          resolvers.delete(buttonId);
        }
        resolve();
      };
      resolvers.set(buttonId, finish);

      let stepIndex = 1;
      const tick = async () => {
        if (resolvers.get(buttonId) !== finish) {
          return;
        }
        try {
          const progress = stepIndex / steps;
          const isLast = stepIndex >= steps;
          const next = isLast ? end : clampBrightness(Math.round(start + delta * progress));
          await this.setBrightnessFromFade(buttonId, next, execute, trigger);
          if (resolvers.get(buttonId) !== finish) {
            return;
          }
          if (isLast) {
            finish();
            return;
          }
          stepIndex += 1;
          timers.set(buttonId, setTimeout(tick, intervalMs));
        } catch {
          finish();
        }
      };

      timers.set(buttonId, setTimeout(tick, intervalMs));
    });
  }

  /**
   * Bricht einen ggf. laufenden Fade fuer den angegebenen Button ab.
   * Loest gleichzeitig das wartende `fadeBrightness`-Promise auf, damit der
   * aufrufende Workflow nicht haengen bleibt.
   */
  cancelBrightnessFade(buttonId: string): void {
    const timers = FADE_TIMERS.get(this);
    if (timers) {
      const timer = timers.get(buttonId);
      if (timer) {
        clearTimeout(timer);
        timers.delete(buttonId);
      }
    }
    const resolvers = FADE_RESOLVERS.get(this);
    if (resolvers) {
      const resolver = resolvers.get(buttonId);
      if (resolver) {
        resolvers.delete(buttonId);
        resolver();
      }
    }
  }

  /**
   * Interner Helligkeits-Update aus dem Fade-Timer heraus, der den Fade NICHT
   * abbricht (sonst wuerde der erste Schritt seinen eigenen Timer killen).
   */
  private async setBrightnessFromFade(
    buttonId: string,
    brightness: number,
    execute: boolean,
    trigger: boolean
  ): Promise<void> {
    const deviceBefore = { ...this };
    const button = this.buttons?.[buttonId];
    if (!button) return;
    button.setBrightness(brightness);
    if (brightness > 0) {
      button.setOn(true);
    } else if (brightness === 0) {
      button.setOn(false);
    }
    if (execute) {
      await this.executeSetBrightness(buttonId, brightness);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSwitchStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSwitchBrightnessChanged(this.id, deviceBefore, buttonId, brightness));
      this.eventManager?.triggerEvent(new EventSwitchBrightnessEquals(this.id, deviceBefore, buttonId, brightness));
      this.eventManager?.triggerEvent(new EventSwitchBrightnessLess(this.id, deviceBefore, buttonId, brightness));
      this.eventManager?.triggerEvent(new EventSwitchBrightnessGreater(this.id, deviceBefore, buttonId, brightness));
    }
  }

  protected abstract executeSetBrightness(buttonId: string, brightness: number): Promise<void>;
}
