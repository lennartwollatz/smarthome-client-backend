export class User {
  id: string = "";
  name: string = "";
  email: string = "";
  role: string = "";
  avatar: string = "";
  present: boolean = false;
  locationTrackingEnabled: boolean = false;
  trackingToken: string = "";
  pushNotificationsEnabled: boolean = false;
  emailNotificationsEnabled: boolean = false;
  smsNotificationsEnabled: boolean = false;
  phoneNumber: string = "";

  presenceDevicePort: number = 0;
  presencePairingCode: string = "";
  presencePasscode: number = 0;
  presenceDiscriminator: number = 0;
  presenceNodeId: string = "";
  presenceDeviceId:string = "";

  constructor(init?: Partial<User>) {
    Object.assign(this, init);
  }
}
