/** Zeile der Tabelle `modules`. */
export class DbModule {
  readonly id!: string;
  readonly isInstalled!: boolean;
  readonly isActive!: boolean;
  readonly isPurchased!: boolean;
  readonly isDisabled!: boolean;

  constructor(fields: DbModule) {
    Object.assign(this, fields);
  }
}
