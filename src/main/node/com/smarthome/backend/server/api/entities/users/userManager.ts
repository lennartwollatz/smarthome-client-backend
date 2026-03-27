import { randomUUID } from "node:crypto";
import { logger } from "../../../../logger.js";
import { User } from "./User.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import type { MatterModuleManager } from "../../modules/matter/matterModuleManager.js";
import { EntityManager } from "../EntityManager.js";
import { LiveUpdateService } from "../../services/live.service.js";

export class UserManager implements EntityManager {
  private userRepository: JsonRepository<User>;
  private liveUpdateService?: LiveUpdateService;
  private matterModuleManager?: MatterModuleManager;

  constructor(
    databaseManager: DatabaseManager
  ) {
    this.userRepository = new JsonRepository<User>(databaseManager, "User");
  }

  setLiveUpdateService(service: LiveUpdateService): void {
    this.liveUpdateService = service;
  }

  setMatterModuleManager(moduleManager: MatterModuleManager): void {
    this.matterModuleManager = moduleManager;
  }

  findAll(): User[] {
    return this.userRepository.findAll();
  }

  findById(userId: string): User | null {
    return this.userRepository.findById(userId);
  }

  async createUser(body: User): Promise<User | null> {
    const user = body;

    if (!user.id) {
      user.id = `user-${randomUUID()}`;
    }
    if (user.locationTrackingEnabled == null) user.locationTrackingEnabled = false;
    if (user.pushNotificationsEnabled == null) user.pushNotificationsEnabled = false;
    if (user.emailNotificationsEnabled == null) user.emailNotificationsEnabled = false;
    if (user.smsNotificationsEnabled == null) user.smsNotificationsEnabled = false;

    try {
      const matter = await this.matterModuleManager?.createPresenceDeviceForUser(user.id);
      if (!matter) return null;
      user.presenceNodeId = matter.nodeId;
      user.presenceDevicePort = matter.port;
      user.presencePairingCode = matter.pairingCode;
      user.presencePasscode = matter.passcode;
      user.presenceDiscriminator = matter.discriminator;
      user.presenceDeviceId = matter.presenceDeviceId;
    } catch (err) {
      return null;
    }

    this.userRepository.save(user.id, user);
    return user;
  }

  updateUser(userId: string, body: User): User | null {
    const existingUser = this.userRepository.findById(userId);
    if (!existingUser) return null;
    const user = body;
    user.id = userId;

    if (existingUser) {
      user.name = existingUser.name;
      user.email = existingUser.email;
      user.role = existingUser.role;
      user.avatar = existingUser.avatar;
      user.locationTrackingEnabled = existingUser.locationTrackingEnabled;
      user.pushNotificationsEnabled = existingUser.pushNotificationsEnabled;
      user.emailNotificationsEnabled = existingUser.emailNotificationsEnabled;
      user.smsNotificationsEnabled = existingUser.smsNotificationsEnabled;
      user.phoneNumber = existingUser.phoneNumber;
    }

    this.userRepository.save(user.id, user);
    return user;
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      await this.matterModuleManager?.removePresenceDeviceForUser(userId);
    } catch (err) {
      logger.error({ err, userId }, "Fehler beim Entfernen des Presence-Device");
      return false;
    }
    return this.userRepository.deleteById(userId);
  }

  regenerateTrackingToken(userId: string): User | null {
    const user = this.userRepository.findById(userId);
    if (!user) return null;
    const newToken = randomUUID().replace(/-/g, "");
    user.trackingToken = newToken;
    this.userRepository.save(userId, user);
    return user;
  }

  setUserPresent(userId: string): User | null {
    const user = this.userRepository.findById(userId);
    if (!user) return null;
    user.present = true;
    if (!this.matterModuleManager?.setUserPresent(user.id)) return null;
    this.userRepository.save(userId, user);
    return user;
  }

  setUserAbsent(userId: string): User | null {
    const user = this.userRepository.findById(userId);
    if (!user) return null;
    user.present = false;
    if (!this.matterModuleManager?.setUserAbsent(user.id)) return null;
    this.userRepository.save(userId, user);
    return user;
  }
}
