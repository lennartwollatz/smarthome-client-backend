export class Point {
  x?: number;
  y?: number;

  constructor(init?: Partial<Point>) {
    Object.assign(this, init);
  }
}
