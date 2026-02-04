import { DeviceSwitch } from "./DeviceSwitch.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

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
  static EnergyBoolFunctionName = {
    ENERGY_USAGE_HIGHER: "energyUsageHigher(int, string)"
  } as const;

  static EnergyTriggerFunctionName = {
    ENERGY_USAGE_IS_HIGHER: "energyUsageIsHigher(int, string)"
  } as const;

  energyUsage!: Energy;
  energyUsages!: EnergyUsage[];

  constructor(init?: Partial<DeviceSwitchEnergy>) {
    super(init);
    Object.assign(this, init);
    this.type = DeviceType.SWITCH_ENERGY;
    this.icon = "⚡";
    this.typeLabel = "deviceType.switch-energy";
    
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
    
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  abstract updateValues(): void;

  protected override initializeFunctionsBool() {
    super.initializeFunctionsBool();
    // Füge Energy-Funktionen hinzu
    this.functionsBool = [
      ...(this.functionsBool ?? []),
      DeviceFunction.fromString(DeviceSwitchEnergy.EnergyBoolFunctionName.ENERGY_USAGE_HIGHER, 'bool')
    ];
  }

  protected override initializeFunctionsAction() {
    super.initializeFunctionsAction();
    // Keine zusätzlichen Action-Funktionen für Energy
  }

  protected override initializeFunctionsTrigger() {
    super.initializeFunctionsTrigger();
    // Füge Energy-Trigger hinzu
    this.functionsTrigger = [
      ...(this.functionsTrigger ?? []),
      DeviceFunction.fromString(DeviceSwitchEnergy.EnergyTriggerFunctionName.ENERGY_USAGE_IS_HIGHER, 'void')
    ];
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    
    // Prüfe Energy-Trigger
    const isEnergyTrigger = Object.values(DeviceSwitchEnergy.EnergyTriggerFunctionName).includes(
      triggerName as (typeof DeviceSwitchEnergy.EnergyTriggerFunctionName)[keyof typeof DeviceSwitchEnergy.EnergyTriggerFunctionName]
    );
    if (isEnergyTrigger) {
      this.checkEnergyListener(triggerName);
    }
  }

  private checkEnergyListener(triggerName: string) {
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceSwitchEnergy.EnergyTriggerFunctionName.ENERGY_USAGE_IS_HIGHER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          const timePeriod = pair.getParams()?.getParam2AsString();
          return threshold != null && timePeriod != null && this.energyUsageHigher(threshold, timePeriod);
        })
        .forEach(pair => pair.run());
    }
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
   */
  setEnergyUsage(energyUsage: Energy, execute: boolean) {
    this.energyUsage = energyUsage;
    if (execute) {
      this.executeSetEnergyUsage(energyUsage);
    }
    this.checkListener(DeviceSwitchEnergy.EnergyTriggerFunctionName.ENERGY_USAGE_IS_HIGHER);
  }

  protected abstract executeSetEnergyUsage(energyUsage: Energy): void;

  /**
   * Setzt die historischen Energieverbrauchsdaten
   * @param energyUsages Array von historischen Energieverbrauchsdaten
   */
  setEnergyUsages(energyUsages: EnergyUsage[]) {
    this.energyUsages = energyUsages;
  }

  /**
   * Gibt zurück, ob das Gerät aktiv ist.
   * Für Switch-Energy-Geräte: aktiv wenn mindestens ein Button `on === true` ist
   */
  isActive(): boolean {
    return Object.values(this.buttons ?? {}).some(button => button.on);
  }
}

