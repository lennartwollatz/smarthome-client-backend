export class User {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  avatar?: string;
  lastActive?: string;
  locationTrackingEnabled?: boolean;
  trackingToken?: string;
  pushNotificationsEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
  phoneNumber?: string;

  presenceDevicePort?: number;
  presencePairingCode?: string;
  presencePasscode?: number;
  presenceDiscriminator?: number;

  constructor(init?: Partial<User>) {
    Object.assign(this, init);
  }
}
