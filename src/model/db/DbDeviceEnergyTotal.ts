/** Zeile der Tabelle `device_energy_totals` (Feld energyUsage eines Energie-Schalters). */
export class DbDeviceEnergyTotal {
  readonly deviceId!: string;
  readonly currentUsage!: number;
  readonly todayTotal!: number;
  readonly yesterdayUntilNow!: number;
  readonly yesterdayTotal!: number;
  readonly weekTotal!: number;
  readonly lastWeekUntilNow!: number;
  readonly lastWeekTotal!: number;
  readonly monthTotal!: number;
  readonly lastMonthUntilNow!: number;
  readonly lastMonthTotal!: number;
  readonly yearTotal!: number;
  readonly lastYearUntilNow!: number;
  readonly lastYearTotal!: number;

  constructor(fields: DbDeviceEnergyTotal) {
    Object.assign(this, fields);
  }
}
