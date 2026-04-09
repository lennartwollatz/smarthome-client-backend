import { DeviceSwitch } from "./DeviceSwitch.js";
import { DeviceType } from "./helper/DeviceType.js";

export abstract class DeviceSwitchEnergy extends DeviceSwitch {

  constructor(init?: Partial<DeviceSwitchEnergy>) {
    super(init);
    this.assignInit(init as any);
    this.type = DeviceType.SWITCH_ENERGY;
  }

  abstract updateValues(): Promise<void>;

  isEnergyUsageHigher(button:string, threshold: number, timePeriod: string): boolean {
    const buttonButton = this.buttons[button];
    if (!buttonButton || !buttonButton.energyUsage) {
      return false;
    }
    let usageValue: number = 0;
    switch (timePeriod.toLowerCase()) {
      case 'now':
        usageValue = buttonButton.energyUsage!.now;
        break;
      case 'day':
        usageValue = buttonButton.energyUsage!.tt;
        break;
      case 'week':
        usageValue = buttonButton.energyUsage!.wt;
        break;
      case 'month':
        usageValue = buttonButton.energyUsage!.mt;
        break;
      case 'year':
        usageValue = buttonButton.energyUsage!.yt;
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
  energyUsageHigher(button:string, threshold: number, timePeriod: string): boolean {
    const buttonButton = this.buttons[button];
    if (!buttonButton || !buttonButton.energyUsage) {
      return false;
    }

    let usageValue: number = 0;
    switch (timePeriod.toLowerCase()) {
      case 'now':
        usageValue = buttonButton.energyUsage!.now;
        break;
      case 'day':
        usageValue = buttonButton.energyUsage!.tt;
        break;
      case 'week':
        usageValue = buttonButton.energyUsage!.wt;
        break;
      case 'month':
        usageValue = buttonButton.energyUsage!.mt;
        break;
      case 'year':
        usageValue = buttonButton.energyUsage!.yt;
        break;
      default:
        return false;
    }

    return usageValue > threshold;
  }


}

