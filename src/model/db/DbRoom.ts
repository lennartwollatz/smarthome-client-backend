/** Zeile der Tabelle `rooms`. */
export class DbRoom {
  readonly id!: string;
  readonly name!: string | null;
  readonly icon!: string | null;
  readonly color!: string | null;
  readonly temperature!: number | null;
  readonly posX!: number | null;
  readonly posY!: number | null;
  readonly width!: number | null;
  readonly height!: number | null;
  readonly sortIndex!: number;

  constructor(fields: DbRoom) {
    Object.assign(this, fields);
  }
}
