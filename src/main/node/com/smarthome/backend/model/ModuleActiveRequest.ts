export class ModuleActiveRequest {
  isActive?: boolean;

  constructor(init?: Partial<ModuleActiveRequest>) {
    Object.assign(this, init);
  }
}
