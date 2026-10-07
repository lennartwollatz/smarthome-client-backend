export class NotificationSettings {
  security?: boolean;
  batterystatus?: boolean;
  energyreport?: boolean;

  constructor(init?: Partial<NotificationSettings>) {
    Object.assign(this, init);
  }
}
