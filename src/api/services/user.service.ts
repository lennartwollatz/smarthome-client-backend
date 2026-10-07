import { randomUUID } from "node:crypto";
import { logger } from "../../config/logger.js";
import type { UserRepository } from "../../db/repositories/UserRepository.js";
import { User } from "../../model/User.js";
import type { MatterPresenceDeviceManager } from "../../modules/presence/MatterPresenceDeviceManager.js";
import type { Request_CreateUser } from "../../model/requests/Request_CreateUser.js";
import type { Request_DeleteUser } from "../../model/requests/Request_DeleteUser.js";
import type { Request_GetUser } from "../../model/requests/Request_GetUser.js";
import type { Request_GetUsers } from "../../model/requests/Request_GetUsers.js";
import type { Request_RegenerateUserTrackingToken } from "../../model/requests/Request_RegenerateUserTrackingToken.js";
import type { Request_UpdateUser } from "../../model/requests/Request_UpdateUser.js";
import { Response_CreateUser } from "../../model/responses/Response_CreateUser.js";
import { Response_DeleteUser } from "../../model/responses/Response_DeleteUser.js";
import { Response_GetUser } from "../../model/responses/Response_GetUser.js";
import { Response_GetUsers } from "../../model/responses/Response_GetUsers.js";
import { Response_RegenerateUserTrackingToken } from "../../model/responses/Response_RegenerateUserTrackingToken.js";
import { Response_UpdateUser } from "../../model/responses/Response_UpdateUser.js";
import { Response_User } from "../../model/responses/Response_User.js";
import { ApiError } from "../http/ApiError.js";

const USER_NOT_FOUND = "User not found";

export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly presenceManager: MatterPresenceDeviceManager
  ) {}

  async getUsers(_request: Request_GetUsers): Promise<Response_GetUsers> {
    const users = await this.userRepository.findAll();
    return new Response_GetUsers(users.map(user => new Response_User(user)));
  }

  async getUser(request: Request_GetUser): Promise<Response_GetUser> {
    return new Response_GetUser(await this.requireUser(request.userId));
  }

  async createUser(request: Request_CreateUser): Promise<Response_CreateUser> {
    const user = new User({
      id: request.id ?? `user-${randomUUID()}`,
      name: request.name ?? undefined,
      email: request.email ?? undefined,
      role: request.role ?? undefined,
      avatar: request.avatar ?? undefined,
      lastActive: request.lastActive ?? undefined,
      phoneNumber: request.phoneNumber ?? undefined,
      trackingToken: request.trackingToken ?? undefined,
      locationTrackingEnabled: request.locationTrackingEnabled ?? false,
      pushNotificationsEnabled: request.pushNotificationsEnabled ?? false,
      emailNotificationsEnabled: request.emailNotificationsEnabled ?? false,
      smsNotificationsEnabled: request.smsNotificationsEnabled ?? false
    });

    try {
      const presence = await this.presenceManager.createPresenceDevice(user);
      user.presencePairingCode = presence.manualPairingCode;
      user.presencePasscode = presence.passcode;
      user.presenceDiscriminator = presence.discriminator;
      user.presenceDevicePort = presence.port;
    } catch (err) {
      logger.error({ err, userId: user.id }, "Fehler beim Erstellen des Presence-Device");
    }

    await this.userRepository.save(user);
    return new Response_CreateUser(user);
  }

  async updateUser(request: Request_UpdateUser): Promise<Response_UpdateUser> {
    const existing = await this.userRepository.findById(request.userId);
    const user = new User({
      id: request.userId,
      name: request.name ?? undefined,
      email: request.email ?? undefined,
      role: request.role ?? undefined,
      avatar: request.avatar ?? undefined,
      lastActive: request.lastActive ?? undefined,
      phoneNumber: request.phoneNumber ?? undefined,
      trackingToken: request.trackingToken ?? undefined,
      locationTrackingEnabled: request.locationTrackingEnabled ?? undefined,
      pushNotificationsEnabled: request.pushNotificationsEnabled ?? undefined,
      emailNotificationsEnabled: request.emailNotificationsEnabled ?? undefined,
      smsNotificationsEnabled: request.smsNotificationsEnabled ?? undefined,
      presenceDevicePort: existing?.presenceDevicePort,
      presencePairingCode: existing?.presencePairingCode,
      presencePasscode: existing?.presencePasscode,
      presenceDiscriminator: existing?.presenceDiscriminator
    });

    await this.userRepository.save(user);
    return new Response_UpdateUser();
  }

  async deleteUser(request: Request_DeleteUser): Promise<Response_DeleteUser> {
    try {
      await this.presenceManager.removePresenceDevice(request.userId);
    } catch (err) {
      logger.error({ err, userId: request.userId }, "Fehler beim Entfernen des Presence-Device");
    }

    if (!(await this.userRepository.deleteById(request.userId))) {
      throw ApiError.notFound(USER_NOT_FOUND);
    }
    return new Response_DeleteUser();
  }

  async regenerateTrackingToken(
    request: Request_RegenerateUserTrackingToken
  ): Promise<Response_RegenerateUserTrackingToken> {
    const user = await this.requireUser(request.userId);
    user.trackingToken = randomUUID().replace(/-/g, "");
    await this.userRepository.save(user);
    return new Response_RegenerateUserTrackingToken(user.trackingToken);
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw ApiError.notFound(USER_NOT_FOUND);
    return user;
  }
}
