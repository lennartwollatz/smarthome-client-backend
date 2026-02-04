export class UpdateComponentRequest {
  component?: string;

  constructor(init?: Partial<UpdateComponentRequest>) {
    Object.assign(this, init);
  }
}
