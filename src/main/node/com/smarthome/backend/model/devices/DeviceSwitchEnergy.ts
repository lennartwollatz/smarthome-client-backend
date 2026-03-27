import { DeviceSwitch } from "./DeviceSwitch.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventSwitchEnergyUsageChanged } from "../../server/events/events/EventSwitchEnergyUsageChanged.js";
import { EventSwitchEnergyUsageHigher } from "../../server/events/events/EventSwitchEnergyUsageHigher.js";

/**
 * Interface für EnergyUsage (historische Energieverbrauchsdaten)
 */
export interface EnergyUsage {
  time: string | number; // Zeitstempel
  value: number; // Energieverbrauchswert
}

/**
 * Interface für Energy (aktuelle und historische Energieverbrauchsdaten)
 */
export interface Energy {
  now: number; // aktueller Energieverbrauch
  tt: number; // Energieverbrauch start des Tages bis jetzt
  ltt: number; // Energieverbrauch start letzter Tag bis jetzige Uhrzeit letzter Tag
  lt: number; // Energieverbrauch vollkommender letzter Tag
  wt: number; // Energieverbrauch start der Woche bis jetzt
  lwt: number; // Energieverbrauch start letzter Woche bis jetzige Uhrzeit & Tag letzte Woche
  lw: number; // Energieverbrauch vollkommende letzte Woche
  mt: number; // Energieverbrauch Monat bis jetzt
  lmt: number; // Energieverbrauch letzter Monat bis jetzige Uhrzeit
  lm: number; // Energieverbrauch vollkommender letzter Monat
  yt: number; // Energieverbrauch Jahr bis jetzt
  ylt: number; // Energieverbrauch letztes Jahr bis jetzige Uhrzeit
  yl: number; // Energieverbrauch vollkommendes letztes Jahr
}

export abstract class DeviceSwitchEnergy extends DeviceSwitch {
  energyUsage!: Energy;
  energyUsages!: EnergyUsage[];

  constructor(init?: Partial<DeviceSwitchEnergy>) {
    super(init);
    this.assignInit(init as any);
    this.type = DeviceType.SWITCH_ENERGY;

    // Initialisiere energyUsage mit Default-Werten falls nicht vorhanden
    if (!this.energyUsage) {
      this.energyUsage = {
        now: 0,
        tt: 0,
        ltt: 0,
        lt: 0,
        wt: 0,
        lwt: 0,
        lw: 0,
        mt: 0,
        lmt: 0,
        lm: 0,
        yt: 0,
        ylt: 0,
        yl: 0
      };
    }
    
    // Initialisiere energyUsages falls nicht vorhanden
    if (!this.energyUsages) {
      this.energyUsages = [];
    }
  }

  abstract updateValues(): Promise<void>;


  isEnergyUsageHigher(threshold: number, timePeriod: string): boolean {
    if (!this.energyUsage) {
      return false;
    }
    let usageValue: number = 0;
    switch (timePeriod.toLowerCase()) {
      case 'now':
        usageValue = this.energyUsage.now;
        break;
      case 'day':
        usageValue = this.energyUsage.tt;
        break;
      case 'week':
        usageValue = this.energyUsage.wt;
        break;
      case 'month':
        usageValue = this.energyUsage.mt;
        break;
      case 'year':
        usageValue = this.energyUsage.yt;
        break;
      default:
        return false;
    }
    return usageValue > threshold;
  }


  /**
   * Gibt die verfügbaren Zeiträume für Energieverbrauch zurück
   * @returns Array von verfügbaren Zeitraum-Werten
   */
  getEnergyUsageTimes(): string[] {
    return ['now', 'day', 'week', 'month', 'year'];
  }

  /**
   * Prüft, ob der Energieverbrauch für einen bestimmten Zeitraum höher als ein Schwellenwert ist
   * @param threshold Der Schwellenwert
   * @param timePeriod Der Zeitraum (now, day, week, month, year)
   * @returns true, wenn der Energieverbrauch höher als der Schwellenwert ist
   */
  energyUsageHigher(threshold: number, timePeriod: string): boolean {
    if (!this.energyUsage) {
      return false;
    }

    let usageValue: number = 0;
    switch (timePeriod.toLowerCase()) {
      case 'now':
        usageValue = this.energyUsage.now;
        break;
      case 'day':
        usageValue = this.energyUsage.tt;
        break;
      case 'week':
        usageValue = this.energyUsage.wt;
        break;
      case 'month':
        usageValue = this.energyUsage.mt;
        break;
      case 'year':
        usageValue = this.energyUsage.yt;
        break;
      default:
        return false;
    }

    return usageValue > threshold;
  }

  /**
   * Setzt den Energieverbrauch für einen bestimmten Zeitraum
   * @param energyUsage Die Energieverbrauchsdaten
   * @param execute Ob die Änderung ausgeführt werden soll
   * @param trigger Ob Events ausgelöst werden sollen
   */
  async setEnergyUsage(energyUsage: Energy, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.energyUsage = energyUsage;
    if (execute) {
      await this.executeSetEnergyUsage(energyUsage);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSwitchEnergyUsageChanged(this.id, deviceBefore, energyUsage));
      this.eventManager?.triggerEvent(new EventSwitchEnergyUsageHigher(this.id, deviceBefore, energyUsage));
    }
  }

  protected abstract executeSetEnergyUsage(energyUsage: Energy): Promise<void>;

  /**
   * Setzt die historischen Energieverbrauchsdaten
   * @param energyUsages Array von historischen Energieverbrauchsdaten
   */
  setEnergyUsages(energyUsages: EnergyUsage[]) {
    this.energyUsages = energyUsages;
  }

}

