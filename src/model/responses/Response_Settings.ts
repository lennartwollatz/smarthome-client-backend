import type { Settings } from "../Settings.js";

/** Einstellungen inkl. abgeleiteter Systemwerte, wie sie die Settings-Endpunkte zurückgeben. */
export class Response_Settings {
  constructor(readonly settings: Settings) {}

  toJSON(): Settings {
    return this.settings;
  }
}
