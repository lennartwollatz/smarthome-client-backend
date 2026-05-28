import type { EnergyUsage } from "../../model/devices/energyTypes.js";

/** Schreib-/Lesezugriff auf den Energie-Verlauf (pro Gerät, separate DB — nicht im Geräte-Objekt). */
export interface SwitchEnergyHistoryAccess {
  getLiveUsages(buttonId: string): EnergyUsage[];
  setLiveUsages(buttonId: string, usages: EnergyUsage[]): void;
}
