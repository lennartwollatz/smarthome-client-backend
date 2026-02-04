import { ModuleVersion } from "./ModuleVersion.js";

export class Module {
  id?: string;
  name?: string;
  shortDescription?: string;
  longDescription?: string;
  icon?: string;
  categoryKey?: string;
  isInstalled?: boolean;
  isActive?: boolean;
  price?: number;
  features?: string[];
  version?: ModuleVersion;
  isPurchased?: boolean;
  isDisabled?: boolean;
  devices?: string[];

  constructor(init?: Partial<Module>) {
    Object.assign(this, init);
  }
}
