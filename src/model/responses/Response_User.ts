import type { User } from "../User.js";

/** Benutzer, wie ihn die Benutzer-Endpunkte zurückgeben. */
export class Response_User {
  readonly id?: string;
  readonly name?: string;
  readonly email?: string;
  readonly role?: string;
  readonly avatar?: string;
  readonly lastActive?: string;
  readonly phoneNumber?: string;
  readonly trackingToken?: string;
  readonly locationTrackingEnabled?: boolean;
  readonly pushNotificationsEnabled?: boolean;
  readonly emailNotificationsEnabled?: boolean;
  readonly smsNotificationsEnabled?: boolean;
  readonly presenceDevicePort?: number;
  readonly presencePairingCode?: string;
  readonly presencePasscode?: number;
  readonly presenceDiscriminator?: number;

  constructor(user: User) {
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.role = user.role;
    this.avatar = user.avatar;
    this.lastActive = user.lastActive;
    this.phoneNumber = user.phoneNumber;
    this.trackingToken = user.trackingToken;
    this.locationTrackingEnabled = user.locationTrackingEnabled;
    this.pushNotificationsEnabled = user.pushNotificationsEnabled;
    this.emailNotificationsEnabled = user.emailNotificationsEnabled;
    this.smsNotificationsEnabled = user.smsNotificationsEnabled;
    this.presenceDevicePort = user.presenceDevicePort;
    this.presencePairingCode = user.presencePairingCode;
    this.presencePasscode = user.presencePasscode;
    this.presenceDiscriminator = user.presenceDiscriminator;
  }
}
