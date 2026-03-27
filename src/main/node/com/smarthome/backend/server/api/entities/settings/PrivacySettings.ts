export class PrivacySettings {
  ailearning?: boolean;

  constructor(init?: Partial<PrivacySettings>) {
    Object.assign(this, init);
  }
}
