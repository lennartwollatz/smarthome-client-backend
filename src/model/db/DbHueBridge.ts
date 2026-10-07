/** Zeile der Tabelle `hue_bridges`. */
export class DbHueBridge {
  readonly id!: string;
  readonly name!: string | null;
  readonly address!: string | null;
  readonly port!: number | null;
  readonly isPaired!: boolean;
  readonly modelId!: string | null;
  readonly swVersion!: string | null;
  readonly username!: string | null;
  readonly clientKey!: string | null;

  constructor(fields: DbHueBridge) {
    Object.assign(this, fields);
  }
}
