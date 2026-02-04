export class ModuleVersion {
  currentVersion?: string;
  latestVersion?: string;
  hasUpdate?: boolean;
  supportedFrontendVersion?: string;

  constructor(init?: Partial<ModuleVersion>) {
    Object.assign(this, init);
  }
}
