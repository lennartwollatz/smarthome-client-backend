import { DeviceLight } from "./DeviceLight.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventLightStatusChanged } from "../../server/events/events/EventLightStatusChanged.js";
import { EventBrightnessChanged } from "../../server/events/events/EventBrightnessChanged.js";
import { EventBrightnessEquals } from "../../server/events/events/EventBrightnessEquals.js";
import { EventBrightnessLess } from "../../server/events/events/EventBrightnessLess.js";
import { EventBrightnessGreater } from "../../server/events/events/EventBrightnessGreater.js";

/**
 * Begrenzt die Anzahl der Helligkeits-Updates pro Fade, damit lange Dauern
 * (z. B. 1 Stunde) das Gerät / den Bus nicht unnötig oft ansteuern.
 */
const MAX_FADE_STEPS = 100;
/** Mindestabstand zwischen zwei Fade-Updates (Schutz gegen zu schnelle Bus-Last). */
const MIN_FADE_INTERVAL_MS = 500;

/**
 * Aktiv laufender Fade-Timer pro Geraet — als WeakMap, damit der Timer
 * nicht in toJSON (API/DB) landet und nicht versehentlich serialisiert wird.
 */
const FADE_TIMERS = new WeakMap<DeviceLightDimmer, NodeJS.Timeout>();

/**
 * Berechnet Anzahl Schritte und Intervall fuer einen Fade.
 *
 * Beachtet sowohl `MAX_FADE_STEPS` (Obergrenze fuer Update-Frequenz bei grossen
 * Aenderungen) als auch `MIN_FADE_INTERVAL_MS` (Untergrenze fuer kurze Dauern,
 * damit das Geraet/der Bus nicht ueberlastet wird). Bei sehr kurzen Dauern
 * wird die Anzahl der Schritte automatisch reduziert, damit die Gesamtdauer
 * trotzdem passt.
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

export abstract class DeviceLightDimmer extends DeviceLight {
  brightness?: number;

  constructor(init?: Partial<DeviceLightDimmer>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.LIGHT_DIMMER;
  }

  override toDatabaseJson(): Record<string, unknown> {
    return { ...super.toDatabaseJson(), b: this.brightness ?? 0 };
  }

  isBrightnessEquals(brightness: number): boolean {
    return this.brightness === brightness;
  }
  isBrightnessLess(brightness: number): boolean {
    return (this.brightness ?? 0) < brightness;
  }
  isBrightnessGreater(brightness: number): boolean {
    return (this.brightness ?? 0) > brightness;
  }

  async setBrightness(brightness: number, execute: boolean, trigger: boolean = true) {
    this.cancelBrightnessFade();
    const deviceBefore = { ...this };
    this.brightness = brightness;
    if (execute) {
      await this.executeSetBrightness(brightness);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventLightStatusChanged(this.id, deviceBefore, {...this}));
      this.eventManager?.triggerEvent(new EventBrightnessChanged(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessEquals(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessLess(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessGreater(this.id, deviceBefore, brightness));
    }
  }

  /**
   * Faded die Helligkeit ueber `durationSeconds` von `startBrightness` auf `endBrightness`.
   *
   * Setzt sofort den Startwert und plant N-1 weitere Updates in gleichmaessigen
   * Schritten, das letzte Update ist garantiert genau `endBrightness`. Ein laufender
   * Fade fuer dasselbe Geraet wird vorher abgebrochen (so wie auch ein direkter
   * `setBrightness`-Aufruf einen laufenden Fade abbricht).
   *
   * Wichtig: Der Aufruf kehrt sofort nach dem ersten Setzen zurueck. Der Workflow
   * laeuft also waehrend des Fades weiter; bewusst, damit lange Faden (z. B. 1 h)
   * den Workflow nicht blockieren.
   */
  async fadeBrightness(
    startBrightness: number,
    endBrightness: number,
    durationSeconds: number,
    execute: boolean = true,
    trigger: boolean = true
  ): Promise<void> {
    const start = DeviceLightDimmer.clampBrightness(startBrightness);
    const end = DeviceLightDimmer.clampBrightness(endBrightness);
    const duration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0;

    this.cancelBrightnessFade();
    await this.setBrightness(start, execute, trigger);

    if (duration <= 0 || start === end) {
      if (start !== end) {
        await this.setBrightness(end, execute, trigger);
      }
      return;
    }

    const delta = end - start;
    const { steps, intervalMs } = computeFadeSchedule(duration, delta);

    let stepIndex = 1;
    const tick = async () => {
      try {
        const progress = stepIndex / steps;
        const isLast = stepIndex >= steps;
        const next = isLast
          ? end
          : DeviceLightDimmer.clampBrightness(Math.round(start + delta * progress));
        await this.setBrightnessFromFade(next, execute, trigger);
        if (isLast) {
          FADE_TIMERS.delete(this);
          return;
        }
        stepIndex += 1;
        FADE_TIMERS.set(this, setTimeout(tick, intervalMs));
      } catch {
        FADE_TIMERS.delete(this);
      }
    };

    FADE_TIMERS.set(this, setTimeout(tick, intervalMs));
  }

  /** Bricht einen ggf. laufenden Fade ab (z. B. wenn ein neuer setBrightness/fadeBrightness kommt). */
  cancelBrightnessFade(): void {
    const timer = FADE_TIMERS.get(this);
    if (timer) {
      clearTimeout(timer);
      FADE_TIMERS.delete(this);
    }
  }

  /**
   * Interner Helligkeits-Update aus dem Fade-Timer heraus, der den Fade NICHT
   * abbricht (sonst wuerde der erste Schritt seinen eigenen Timer killen).
   */
  private async setBrightnessFromFade(brightness: number, execute: boolean, trigger: boolean): Promise<void> {
    const deviceBefore = { ...this };
    this.brightness = brightness;
    if (execute) {
      await this.executeSetBrightness(brightness);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventLightStatusChanged(this.id, deviceBefore, {...this}));
      this.eventManager?.triggerEvent(new EventBrightnessChanged(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessEquals(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessLess(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessGreater(this.id, deviceBefore, brightness));
    }
  }

  private static clampBrightness(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  protected abstract executeSetBrightness(brightness: number): Promise<void>;
}
