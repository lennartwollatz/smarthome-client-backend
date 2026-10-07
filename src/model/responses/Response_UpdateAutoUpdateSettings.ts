/** Zeitfenster für automatische Updates (`HH:mm`). */
export class Response_UpdateTimes {
  readonly from?: string | null;
  readonly to?: string | null;

  constructor(fields: Response_UpdateTimes) {
    this.from = fields.from;
    this.to = fields.to;
  }
}

/** PUT /api/settings/system/auto-update – Echo der übermittelten Auto-Update-Einstellungen. */
export class Response_UpdateAutoUpdateSettings {
  readonly autoupdate?: boolean | null;
  readonly updatetimes?: Response_UpdateTimes | null;

  constructor(fields: Response_UpdateAutoUpdateSettings) {
    this.autoupdate = fields.autoupdate;
    this.updatetimes = fields.updatetimes && new Response_UpdateTimes(fields.updatetimes);
  }
}
