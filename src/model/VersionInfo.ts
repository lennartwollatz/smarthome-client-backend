export class VersionInfo {
  currentVersion?: string;
  latestVersion?: string;
  hasUpdate?: boolean;
  supportedFrontendVersion?: string;

  constructor(init?: Partial<VersionInfo>) {
    Object.assign(this, init);
  }
}
