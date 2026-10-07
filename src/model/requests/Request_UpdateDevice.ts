/** Änderbare Felder eines Tasters. */
export class Request_UpdateDeviceButton {
  readonly name?: string | null;
  readonly connectedToLight?: boolean | null;

  constructor(fields: Request_UpdateDeviceButton) {
    Object.assign(this, fields);
  }
}

/** PUT /api/devices/:deviceId – nur die änderbaren Felder des Geräts. */
export class Request_UpdateDevice {
  readonly deviceId!: string;
  readonly name?: string | null;
  /** `null` entfernt die Raumzuordnung. */
  readonly room?: string | null;
  readonly icon?: string | null;
  readonly typeLabel?: string | null;
  readonly quickAccess?: boolean | null;
  readonly temperatureGoal?: number | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly roomMapping?: Record<string, string> | null;
  readonly buttons?: Record<string, Request_UpdateDeviceButton> | null;

  constructor(fields: Request_UpdateDevice) {
    Object.assign(this, fields);
    this.buttons = fields.buttons && Object.fromEntries(
      Object.entries(fields.buttons).map(([buttonId, button]) => [buttonId, new Request_UpdateDeviceButton(button)])
    );
  }
}
