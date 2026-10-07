export class GeneralSettings {
  name?: string;
  sprache?: string;
  temperatur?: string;

  constructor(init?: Partial<GeneralSettings>) {
    Object.assign(this, init);
  }
}
