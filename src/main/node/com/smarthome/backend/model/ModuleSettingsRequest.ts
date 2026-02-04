import { ModuleSetting } from "./ModuleSetting.js";

export class ModuleSettingsRequest {
  settings?: ModuleSetting[];

  constructor(init?: Partial<ModuleSettingsRequest>) {
    Object.assign(this, init);
  }
}
