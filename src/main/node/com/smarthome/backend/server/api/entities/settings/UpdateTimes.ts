export class UpdateTimes {
  from?: string;
  to?: string;

  constructor(init?: Partial<UpdateTimes>) {
    Object.assign(this, init);
  }
}
