export class Position {
  x?: number;
  y?: number;

  constructor(init?: Partial<Position>) {
    Object.assign(this, init);
  }
}
