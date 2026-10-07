/** Bereich `allgemein` der Einstellungen. */
export class Request_GeneralSettings {
  readonly name?: string | null;
  readonly sprache?: string | null;
  readonly temperatur?: string | null;

  constructor(fields: Request_GeneralSettings) {
    Object.assign(this, fields);
  }
}

/** Bereich `notifications` der Einstellungen. */
export class Request_NotificationSettings {
  readonly security?: boolean | null;
  readonly batterystatus?: boolean | null;
  readonly energyreport?: boolean | null;

  constructor(fields: Request_NotificationSettings) {
    Object.assign(this, fields);
  }
}

/** Bereich `privacy` der Einstellungen. */
export class Request_PrivacySettings {
  readonly ailearning?: boolean | null;

  constructor(fields: Request_PrivacySettings) {
    Object.assign(this, fields);
  }
}

/** Zeitfenster für automatische Updates (`HH:mm`). */
export class Request_UpdateTimes {
  readonly from?: string | null;
  readonly to?: string | null;

  constructor(fields: Request_UpdateTimes) {
    Object.assign(this, fields);
  }
}

/** Speicherbarer Teil des Bereichs `system`; Versionen und Server-IP werden abgeleitet. */
export class Request_SystemSettings {
  readonly autoupdate?: boolean | null;
  readonly updatetimes?: Request_UpdateTimes | null;

  constructor(fields: Request_SystemSettings) {
    this.autoupdate = fields.autoupdate;
    this.updatetimes = fields.updatetimes && new Request_UpdateTimes(fields.updatetimes);
  }
}
