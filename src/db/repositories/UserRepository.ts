import type { RowDataPacket } from "mysql2/promise";
import { DbUser } from "../../model/db/DbUser.js";
import { DbUserPresenceDevice } from "../../model/db/DbUserPresenceDevice.js";
import { User } from "../../model/User.js";
import type { DatabaseManager, SqlExecutor } from "../database.js";
import { fromNullable, toBoolean, toStringParam } from "../sqlValues.js";

const SQL_SELECT_USERS = `
  SELECT
      u.id,
      u.name,
      u.email,
      u.phone_number                AS phoneNumber,
      u.role,
      u.avatar,
      u.last_active                 AS lastActive,
      u.location_tracking_enabled   AS locationTrackingEnabled,
      u.tracking_token              AS trackingToken,
      u.push_notifications_enabled  AS pushNotificationsEnabled,
      u.email_notifications_enabled AS emailNotificationsEnabled,
      u.sms_notifications_enabled   AS smsNotificationsEnabled,
      p.user_id                     AS presenceUserId,
      p.port                        AS presencePort,
      p.passcode                    AS presencePasscode,
      p.discriminator               AS presenceDiscriminator,
      p.pairing_code                AS presencePairingCode
  FROM users AS u
  LEFT JOIN user_presence_devices AS p
      ON p.user_id = u.id`;

const SQL_SELECT_ALL_USERS = `${SQL_SELECT_USERS}
  ORDER BY u.created_at`;

const SQL_SELECT_USER_BY_ID = `${SQL_SELECT_USERS}
  WHERE u.id = ?`;

const SQL_SELECT_PRESENCE_PORTS = `
  SELECT p.port
  FROM user_presence_devices AS p`;

const SQL_UPSERT_USER = `
  INSERT INTO users (
      id, name, email, phone_number, role, avatar, last_active,
      location_tracking_enabled, tracking_token,
      push_notifications_enabled, email_notifications_enabled, sms_notifications_enabled
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      name                        = incoming.name,
      email                       = incoming.email,
      phone_number                = incoming.phone_number,
      role                        = incoming.role,
      avatar                      = incoming.avatar,
      last_active                 = incoming.last_active,
      location_tracking_enabled   = incoming.location_tracking_enabled,
      tracking_token              = incoming.tracking_token,
      push_notifications_enabled  = incoming.push_notifications_enabled,
      email_notifications_enabled = incoming.email_notifications_enabled,
      sms_notifications_enabled   = incoming.sms_notifications_enabled`;

const SQL_UPSERT_PRESENCE_DEVICE = `
  INSERT INTO user_presence_devices (user_id, port, passcode, discriminator, pairing_code)
  VALUES (?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      port          = incoming.port,
      passcode      = incoming.passcode,
      discriminator = incoming.discriminator,
      pairing_code  = incoming.pairing_code`;

const SQL_DELETE_PRESENCE_DEVICE = `
  DELETE FROM user_presence_devices
  WHERE user_id = ?`;

const SQL_DELETE_USER = `
  DELETE FROM users
  WHERE id = ?`;

export class UserRepository {
  constructor(private readonly db: DatabaseManager) {}

  async findAll(): Promise<User[]> {
    const rows = await this.db.query<RowDataPacket>(SQL_SELECT_ALL_USERS);
    return rows.map(row => toUser(toDbUser(row), toDbUserPresenceDevice(row)));
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.query<RowDataPacket>(SQL_SELECT_USER_BY_ID, [id]);
    return row ? toUser(toDbUser(row), toDbUserPresenceDevice(row)) : null;
  }

  async findUsedPresencePorts(): Promise<number[]> {
    const rows = await this.db.query<RowDataPacket>(SQL_SELECT_PRESENCE_PORTS);
    return rows.map(row => row.port as number);
  }

  async save(user: User): Promise<void> {
    if (!user.id) {
      throw new Error("Benutzer ohne ID kann nicht gespeichert werden");
    }
    const dbUser = new DbUser({
      id: user.id,
      name: toStringParam(user.name),
      email: toStringParam(user.email),
      phoneNumber: toStringParam(user.phoneNumber),
      role: toStringParam(user.role),
      avatar: toStringParam(user.avatar),
      lastActive: toStringParam(user.lastActive),
      locationTrackingEnabled: user.locationTrackingEnabled === true,
      trackingToken: toStringParam(user.trackingToken),
      pushNotificationsEnabled: user.pushNotificationsEnabled === true,
      emailNotificationsEnabled: user.emailNotificationsEnabled === true,
      smsNotificationsEnabled: user.smsNotificationsEnabled === true
    });
    const dbPresenceDevice = fromPresenceDevice(dbUser.id, user);

    await this.db.transaction(async tx => {
      await tx.execute(SQL_UPSERT_USER, [
        dbUser.id,
        dbUser.name,
        dbUser.email,
        dbUser.phoneNumber,
        dbUser.role,
        dbUser.avatar,
        dbUser.lastActive,
        dbUser.locationTrackingEnabled,
        dbUser.trackingToken,
        dbUser.pushNotificationsEnabled,
        dbUser.emailNotificationsEnabled,
        dbUser.smsNotificationsEnabled
      ]);
      await savePresenceDevice(tx, dbUser.id, dbPresenceDevice);
    });
  }

  async deleteById(id: string): Promise<boolean> {
    return (await this.db.execute(SQL_DELETE_USER, [id])) > 0;
  }
}

/** Ohne Port, Passcode und Discriminator hat der Benutzer kein Anwesenheitsgerät. */
function fromPresenceDevice(userId: string, user: User): DbUserPresenceDevice | null {
  const { presenceDevicePort, presencePasscode, presenceDiscriminator } = user;
  if (presenceDevicePort == null || presencePasscode == null || presenceDiscriminator == null) {
    return null;
  }
  return new DbUserPresenceDevice({
    userId,
    port: presenceDevicePort,
    passcode: presencePasscode,
    discriminator: presenceDiscriminator,
    pairingCode: toStringParam(user.presencePairingCode)
  });
}

async function savePresenceDevice(
  tx: SqlExecutor,
  userId: string,
  dbPresenceDevice: DbUserPresenceDevice | null
): Promise<void> {
  if (!dbPresenceDevice) {
    await tx.execute(SQL_DELETE_PRESENCE_DEVICE, [userId]);
    return;
  }
  await tx.execute(SQL_UPSERT_PRESENCE_DEVICE, [
    dbPresenceDevice.userId,
    dbPresenceDevice.port,
    dbPresenceDevice.passcode,
    dbPresenceDevice.discriminator,
    dbPresenceDevice.pairingCode
  ]);
}

function toDbUser(row: RowDataPacket): DbUser {
  return new DbUser({
    id: row.id,
    name: row.name,
    email: row.email,
    phoneNumber: row.phoneNumber,
    role: row.role,
    avatar: row.avatar,
    lastActive: row.lastActive,
    locationTrackingEnabled: toBoolean(row.locationTrackingEnabled),
    trackingToken: row.trackingToken,
    pushNotificationsEnabled: toBoolean(row.pushNotificationsEnabled),
    emailNotificationsEnabled: toBoolean(row.emailNotificationsEnabled),
    smsNotificationsEnabled: toBoolean(row.smsNotificationsEnabled)
  });
}

/** Aus dem LEFT JOIN; null, wenn der Benutzer kein Anwesenheitsgerät hat. */
function toDbUserPresenceDevice(row: RowDataPacket): DbUserPresenceDevice | null {
  if (row.presenceUserId == null) return null;
  return new DbUserPresenceDevice({
    userId: row.presenceUserId,
    port: row.presencePort,
    passcode: row.presencePasscode,
    discriminator: row.presenceDiscriminator,
    pairingCode: row.presencePairingCode
  });
}

function toUser(dbUser: DbUser, dbPresenceDevice: DbUserPresenceDevice | null): User {
  return new User({
    id: dbUser.id,
    name: fromNullable(dbUser.name),
    email: fromNullable(dbUser.email),
    phoneNumber: fromNullable(dbUser.phoneNumber),
    role: fromNullable(dbUser.role),
    avatar: fromNullable(dbUser.avatar),
    lastActive: fromNullable(dbUser.lastActive),
    locationTrackingEnabled: dbUser.locationTrackingEnabled,
    trackingToken: fromNullable(dbUser.trackingToken),
    pushNotificationsEnabled: dbUser.pushNotificationsEnabled,
    emailNotificationsEnabled: dbUser.emailNotificationsEnabled,
    smsNotificationsEnabled: dbUser.smsNotificationsEnabled,
    presenceDevicePort: dbPresenceDevice?.port,
    presencePasscode: dbPresenceDevice?.passcode,
    presenceDiscriminator: dbPresenceDevice?.discriminator,
    presencePairingCode: dbPresenceDevice?.pairingCode ?? undefined
  });
}
