/** Zeile der Tabelle `device_vacuums`. */
export class DbDeviceVacuum {
  readonly deviceId!: string;
  readonly isPowered!: boolean | null;
  readonly isCleaning!: boolean | null;
  readonly isDocked!: boolean | null;
  readonly battery!: number | null;
  readonly fanSpeed!: number | null;
  readonly waterBoxLevel!: number | null;
  readonly dirtyWaterBoxLevel!: number | null;
  readonly isWaterBoxFull!: boolean | null;
  readonly isDirtyWaterBoxFull!: boolean | null;
  readonly currentRoom!: string | null;
  readonly currentZone!: string | null;
  readonly mode!: string | null;
  readonly errorMessage!: string | null;

  constructor(fields: DbDeviceVacuum) {
    Object.assign(this, fields);
  }
}
