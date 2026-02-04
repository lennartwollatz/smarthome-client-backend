import { ActionRunnable } from "./actionRunnable.js";
import { logger } from "../../logger.js";
import type { TimeTrigger } from "../../model/index.js";

export class TimeTriggerRunnable extends ActionRunnable {
  private timeTrigger: TimeTrigger;
  private stopped = false;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(timeTrigger: TimeTrigger, workflowRunnable: () => void) {
    super(workflowRunnable);
    if (!timeTrigger) {
      throw new Error("TimeTrigger darf nicht null sein");
    }
    this.timeTrigger = timeTrigger;
  }

  start() {
    if (this.stopped) {
      logger.warn("TimeTriggerRunnable wurde bereits gestoppt, kann nicht gestartet werden");
      return;
    }
    logger.info(
      { frequency: this.timeTrigger.frequency, time: this.timeTrigger.time },
      "Starte TimeTriggerRunnable"
    );
    this.scheduleNextExecution();
  }

  stop() {
    if (!this.stopped) {
      this.stopped = true;
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
    }
  }

  isStopped() {
    return this.stopped;
  }

  override run() {
    if (this.stopped) return;
    try {
      if (this.shouldExecuteNow()) {
        this.listener?.();
      }
    } catch (err) {
      logger.error({ err }, "Fehler beim Ausführen des Time-Triggers");
    } finally {
      if (!this.stopped) {
        this.scheduleNextExecution();
      }
    }
  }

  private shouldExecuteNow() {
    const now = new Date();
    const targetTime = this.parseTime(this.timeTrigger.time);
    if (!targetTime) return false;

    switch (this.timeTrigger.frequency) {
      case "daily":
        return this.shouldExecuteDaily(now, targetTime);
      case "weekly":
        return this.shouldExecuteWeekly(now, targetTime);
      case "monthly":
        return this.shouldExecuteMonthly(now, targetTime);
      case "yearly":
        return this.shouldExecuteYearly(now, targetTime);
      default:
        logger.warn({ frequency: this.timeTrigger.frequency }, "Unbekannte Frequency");
        return false;
    }
  }

  private shouldExecuteDaily(now: Date, targetTime: { h: number; m: number }) {
    const diffMinutes = Math.abs(now.getHours() * 60 + now.getMinutes() - (targetTime.h * 60 + targetTime.m));
    return diffMinutes <= 1;
  }

  private shouldExecuteWeekly(now: Date, targetTime: { h: number; m: number }) {
    if (!this.shouldExecuteDaily(now, targetTime)) return false;
    const weekdays = this.timeTrigger.weekdays ?? [];
    if (!weekdays.length) return true;
    const jsDay = now.getDay(); // 0=Sunday
    return weekdays.includes(jsDay);
  }

  private shouldExecuteMonthly(now: Date, targetTime: { h: number; m: number }) {
    if (!this.shouldExecuteDaily(now, targetTime)) return false;
    return now.getDate() === 1;
  }

  private shouldExecuteYearly(now: Date, targetTime: { h: number; m: number }) {
    if (!this.shouldExecuteDaily(now, targetTime)) return false;
    return now.getMonth() === 0 && now.getDate() === 1;
  }

  private scheduleNextExecution() {
    if (this.stopped) return;
    const next = this.calculateNextExecution();
    if (!next) {
      logger.warn("Konnte nächste Ausführungszeit nicht berechnen");
      return;
    }
    const delay = Math.max(0, next.getTime() - Date.now());
    this.timeoutId = setTimeout(() => this.run(), delay);
  }

  private calculateNextExecution() {
    const now = new Date();
    const targetTime = this.parseTime(this.timeTrigger.time);
    if (!targetTime) return null;

    switch (this.timeTrigger.frequency) {
      case "daily":
        return this.calculateNextDaily(now, targetTime);
      case "weekly":
        return this.calculateNextWeekly(now, targetTime);
      case "monthly":
        return this.calculateNextMonthly(now, targetTime);
      case "yearly":
        return this.calculateNextYearly(now, targetTime);
      default:
        return null;
    }
  }

  private calculateNextDaily(now: Date, targetTime: { h: number; m: number }) {
    const next = new Date(now);
    next.setHours(targetTime.h, targetTime.m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  private calculateNextWeekly(now: Date, targetTime: { h: number; m: number }) {
    const weekdays = this.timeTrigger.weekdays ?? [];
    if (!weekdays.length) return this.calculateNextDaily(now, targetTime);

    let next = this.calculateNextDaily(now, targetTime);
    for (let i = 0; i < 7; i += 1) {
      if (weekdays.includes(next.getDay())) return next;
      next = new Date(next);
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  private calculateNextMonthly(now: Date, targetTime: { h: number; m: number }) {
    const next = new Date(now);
    next.setDate(1);
    next.setHours(targetTime.h, targetTime.m, 0, 0);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    return next;
  }

  private calculateNextYearly(now: Date, targetTime: { h: number; m: number }) {
    const next = new Date(now);
    next.setMonth(0, 1);
    next.setHours(targetTime.h, targetTime.m, 0, 0);
    if (next <= now) next.setFullYear(next.getFullYear() + 1);
    return next;
  }

  private parseTime(timeString?: string) {
    if (!timeString) return null;
    const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return { h, m };
  }
}

