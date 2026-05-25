import { DeviceType } from "./helper/DeviceType.js";
import { EventFanStatusChanged } from "../../server/events/events/EventFanStatusChanged.js";
import { EventBrightnessChanged } from "../../server/events/events/EventBrightnessChanged.js";
import { EventBrightnessEquals } from "../../server/events/events/EventBrightnessEquals.js";
import { EventBrightnessLess } from "../../server/events/events/EventBrightnessLess.js";
import { EventBrightnessGreater } from "../../server/events/events/EventBrightnessGreater.js";
import { DeviceFanLight } from "./DeviceFanLight.js";

/** Begrenzt die Anzahl der Helligkeits-Updates pro Fade. */
const MAX_FADE_STEPS = 100;
/** Mindestabstand zwischen zwei Fade-Updates (Schutz gegen Bus-Last). */
const MIN_FADE_INTERVAL_MS = 500;

/**
 * Aktive Fade-Timer pro Geraet — WeakMap, damit nichts in toJSON (API/DB) landet.
 */
const FADE_TIMERS = new WeakMap<DeviceFanLightDimmer, NodeJS.Timeout>();

/**
 * Resolver des Fade-Promises pro Geraet. Wird beim Abschluss oder vorzeitigem
 * Abbruch aufgerufen, damit `await fadeLightBrightness(...)` zurueckkehrt.
 */
const FADE_RESOLVERS = new WeakMap<DeviceFanLightDimmer, () => void>();

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

export abstract class DeviceFanLightDimmer extends DeviceFanLight {
  lightBrightness?: number;

  constructor(init?: Partial<DeviceFanLightDimmer>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.FAN_LIGHT_DIMMER;
  }

  override toDatabaseJson(): Record<string, unknown> {
    return { ...super.toDatabaseJson(), lb: this.lightBrightness ?? 0 };
  }

  isBrightnessEquals(brightness: number): boolean {
    return this.lightBrightness === brightness;
  }
  isBrightnessLess(brightness: number): boolean {
    return (this.lightBrightness ?? 0) < brightness;
  }
  isBrightnessGreater(brightness: number): boolean {
    return (this.lightBrightness ?? 0) > brightness;
  }

  async setLightBrightness(brightness: number, execute: boolean, trigger: boolean = true) {
    this.cancelLightBrightnessFade();
    let deviceBefore = { ...this };
    this.lightBrightness = brightness;

    if (execute) {
      await this.executeSetLightBrightness(brightness);
    }
    if( trigger ){
      this.eventManager?.triggerEvent(new EventFanStatusChanged(this.id, deviceBefore, {...this}));
      this.eventManager?.triggerEvent(new EventBrightnessChanged(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessEquals(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessLess(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessGreater(this.id, deviceBefore, brightness));
    }
  }

  /**
   * Faded das Licht ueber `durationSeconds` von `startBrightness` auf `endBrightness`.
   * Setzt sofort den Startwert und plant N-1 weitere Updates in gleichmaessigen
   * Schritten. Ein laufender Fade oder ein direkter `setLightBrightness`-Aufruf
   * bricht den Fade ab.
   *
   * Wichtig: Der Aufruf wartet, bis der Fade abgeschlossen ist oder durch einen
   * anderen `setLightBrightness`/`fadeLightBrightness`-Aufruf abgebrochen wurde.
   * Der Workflow geht erst danach zum naechsten Schritt/Node ueber.
   */
  async fadeLightBrightness(
    startBrightness: number,
    endBrightness: number,
    durationSeconds: number,
    execute: boolean = true,
    trigger: boolean = true
  ): Promise<void> {
    const start = clampBrightness(startBrightness);
    const end = clampBrightness(endBrightness);
    const duration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0;

    this.cancelLightBrightnessFade();
    await this.setLightBrightness(start, execute, trigger);

    if (duration <= 0 || start === end) {
      if (start !== end) {
        await this.setLightBrightness(end, execute, trigger);
      }
      return;
    }

    const delta = end - start;
    const { steps, intervalMs } = computeFadeSchedule(duration, delta);

    return new Promise<void>((resolve) => {
      const finish = () => {
        FADE_TIMERS.delete(this);
        FADE_RESOLVERS.delete(this);
        resolve();
      };
      FADE_RESOLVERS.set(this, finish);

      let stepIndex = 1;
      const tick = async () => {
        if (FADE_RESOLVERS.get(this) !== finish) {
          return;
        }
        try {
          const progress = stepIndex / steps;
          const isLast = stepIndex >= steps;
          const next = isLast ? end : clampBrightness(Math.round(start + delta * progress));
          await this.setLightBrightnessFromFade(next, execute, trigger);
          if (FADE_RESOLVERS.get(this) !== finish) {
            return;
          }
          if (isLast) {
            finish();
            return;
          }
          stepIndex += 1;
          FADE_TIMERS.set(this, setTimeout(tick, intervalMs));
        } catch {
          finish();
        }
      };

      FADE_TIMERS.set(this, setTimeout(tick, intervalMs));
    });
  }

  /**
   * Bricht einen ggf. laufenden Fade ab. Loest gleichzeitig das wartende
   * `fadeLightBrightness`-Promise auf, damit der Workflow nicht haengen bleibt.
   */
  cancelLightBrightnessFade(): void {
    const timer = FADE_TIMERS.get(this);
    if (timer) {
      clearTimeout(timer);
      FADE_TIMERS.delete(this);
    }
    const resolver = FADE_RESOLVERS.get(this);
    if (resolver) {
      FADE_RESOLVERS.delete(this);
      resolver();
    }
  }

  /**
   * Interner Helligkeits-Update aus dem Fade-Timer heraus, der den Fade NICHT
   * abbricht (sonst wuerde der erste Schritt seinen eigenen Timer killen).
   */
  private async setLightBrightnessFromFade(brightness: number, execute: boolean, trigger: boolean): Promise<void> {
    let deviceBefore = { ...this };
    this.lightBrightness = brightness;

    if (execute) {
      await this.executeSetLightBrightness(brightness);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventFanStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventBrightnessChanged(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessEquals(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessLess(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessGreater(this.id, deviceBefore, brightness));
    }
  }

  protected abstract executeSetLightBrightness(brightness: number): void | Promise<void>;
}
