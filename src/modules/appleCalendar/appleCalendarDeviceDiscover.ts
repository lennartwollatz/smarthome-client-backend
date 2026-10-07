import type { DatabaseManager } from "../../db/database.js";
import { CredentialsRepository } from "../../db/repositories/CredentialsRepository.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import { APPLECALENDARCONFIG, APPLECALENDARMODULE } from "./appleCalendarModule.js";
import { AppleCalendarDeviceDiscovered } from "./appleCalendarDeviceDiscovered.js";
import { logger } from "../../config/logger.js";
import * as dav from "dav";

export const DEFAULT_CREDENTIALS_ID = "default";

type StoredCredentials = {
  id: string;
  username: string;
  password?: string;
  server?: string;
};

export type AppleCalendarCredentialsInfo = {
  id: string;
  username: string;
  server?: string;
  hasPassword: boolean;
};


export class AppleCalendarDeviceDiscover extends ModuleDeviceDiscover<AppleCalendarDeviceDiscovered> {
  private repo: CredentialsRepository;

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
    this.repo = new CredentialsRepository(databaseManager, APPLECALENDARMODULE.id);
  }

  public getModuleName(): string {
    return APPLECALENDARMODULE.id;
  }

  public getDiscoveredDeviceTypeName(): string {
    return APPLECALENDARCONFIG.deviceTypeName;
  }

  // ── Credentials API ────────────────────────────────────────────────────────
  async getCredentialsInfo(credentialId:string): Promise<AppleCalendarCredentialsInfo> {
    const c = await this.repo.findById(credentialId);
    return { id: credentialId, username: c?.username ?? "", server: c?.server, hasPassword: Boolean(c?.password) };
  }

  async getCredentialInfos(): Promise<AppleCalendarCredentialsInfo[]> {
    const credentials = await this.repo.findAll();
    return credentials.map(c => ({ id: c.id, username: c.username ?? "", server: c.server, hasPassword: Boolean(c.password) }));
  }

  async setCredentials(credentialId: string, username: string, password?: string, server?: string) {
    const existing = await this.repo.findById(credentialId);
    await this.repo.save({
      id: credentialId,
      username,
      server: server ?? existing?.server,
      password: typeof password === "string" ? password : existing?.password
    });
  }

  async setPassword(credentialId: string, password: string) {
    const existing = await this.repo.findById(credentialId);
    if (!existing?.username) throw new Error("username ist nicht gesetzt");
    await this.repo.save({ ...existing, password });
  }

  async setServer(credentialId: string, server: string) {
    const existing = await this.repo.findById(credentialId);
    if (!existing?.username) throw new Error("username ist nicht gesetzt");
    await this.repo.save({ ...existing, server });
  }

  async deleteCredentials(credentialId: string) {
    await this.repo.deleteById(credentialId);
  }

  async testCredentials(credentialId: string): Promise<boolean> {
    try {
      const account = await this.buildAccount(credentialId);
      if (!account) return false;
      return true;
    } catch (err) {
      logger.warn({ err }, "CalDAV Credentials Test fehlgeschlagen");
      return false;
    }
  }

  public async startDiscovery(_timeoutSeconds: number): Promise<AppleCalendarDeviceDiscovered[]> {
    return [];
  }

  public async stopDiscovery(): Promise<void> {
    return;
  }

  public async buildXhr(credentialId: string) {
    const c = await this.getCredentialsOrThrow(credentialId);
    return new dav.transport.Basic(
      new dav.Credentials({
        username: c.username,
        password: c.password
      })
    );
  }

  private async getServer(credentialId: string) {
    const c = await this.getCredentialsOrThrow(credentialId);
    return c.server ?? "https://caldav.icloud.com";
  }

  public async buildAccount(credentialId: string) {
    const xhr = await this.buildXhr(credentialId);
    const client = new dav.Client(xhr);
    const server = await this.getServer(credentialId);
    const account = await client.createAccount({
      server,
      accountType: "caldav",
      loadObjects: true
    });
    return account;
  }


  // ── intern ────────────────────────────────────────────────────────────────
  private async getCredentialsOrThrow(credentialId: string): Promise<StoredCredentials> {
    const c = await this.repo.findById(credentialId);
    if (!c?.username) throw new Error("CalDAV username ist nicht gesetzt");
    if (!c?.password) throw new Error("CalDAV password ist nicht gesetzt");
    return { id: c.id, username: c.username, password: c.password, server: c.server };
  }

  
}

