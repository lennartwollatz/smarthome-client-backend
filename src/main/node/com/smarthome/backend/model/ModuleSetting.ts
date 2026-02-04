export class ModuleSetting {
  key?: string;
  value?: Object;

  constructor(init?: Partial<ModuleSetting>) {
    Object.assign(this, init);
  }
}
