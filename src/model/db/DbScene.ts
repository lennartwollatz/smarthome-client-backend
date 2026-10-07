/** Zeile der Tabelle `scenes`. */
export class DbScene {
  readonly id!: string;
  readonly name!: string | null;
  readonly icon!: string | null;
  readonly description!: string | null;
  readonly isActive!: boolean;
  readonly showOnHome!: boolean;
  readonly isCustom!: boolean;

  constructor(fields: DbScene) {
    Object.assign(this, fields);
  }
}
