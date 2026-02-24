import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import { APPLECALENDARCONFIG, APPLECALENDARMODULE } from "./appleCalendarModule.js";
import { AppleCalendarDeviceDiscovered } from "./appleCalendarDeviceDiscovered.js";
import { logger } from "../../../../logger.js";
import dav from "dav";

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
  private repo: JsonRepository<StoredCredentials>;

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
    this.repo = new JsonRepository<StoredCredentials>(databaseManager, "AppleCalendarCredentials");
  }

  public getModuleName(): string {
    return APPLECALENDARMODULE.id;
  }

  public getDiscoveredDeviceTypeName(): string {
    return APPLECALENDARCONFIG.deviceTypeName;
  }

  // ── Credentials API ────────────────────────────────────────────────────────
  getCredentialsInfo(credentialId:string): AppleCalendarCredentialsInfo {
    const c = this.repo.findById(credentialId);
    return { id: credentialId, username: c?.username ?? "", server: c?.server, hasPassword: Boolean(c?.password) };
  }

  getCredentialInfos(): AppleCalendarCredentialsInfo[] {
    const credentials = this.repo.findAll();
    return credentials.map(c => ({ id: c.id, username: c.username ?? "", server: c.server, hasPassword: Boolean(c.password) }));
  }

  setCredentials(credentialId: string, username: string, password?: string, server?: string) {
    const existing = this.repo.findById(credentialId) ?? { id: credentialId, username: "" };
    const next: StoredCredentials = {
      ...existing,
      id: credentialId,
      username,
      server: server ?? existing.server,
      password: typeof password === "string" ? password : existing.password
    };
    this.repo.save(credentialId, next);
  }

  setPassword(credentialId: string, password: string) {
    const existing = this.repo.findById(credentialId);
    if (!existing?.username) throw new Error("username ist nicht gesetzt");
    this.repo.save(credentialId, { ...existing, password });
  }

  setServer(credentialId: string, server: string) {
    const existing = this.repo.findById(credentialId);
    if (!existing?.username) throw new Error("username ist nicht gesetzt");
    this.repo.save(credentialId, { ...existing, server });
  }

  deleteCredentials(credentialId: string) {
    this.repo.deleteById(credentialId);
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

  public buildXhr(credentialId: string) {
    const c = this.getCredentialsOrThrow(credentialId);
    return new dav.transport.Basic(
      new dav.Credentials({
        username: c.username,
        password: c.password
      })
    );
  }

  private getServer(credentialId: string) {
    const c = this.getCredentialsOrThrow(credentialId);
    return c.server ?? "https://caldav.icloud.com";
  }

  public async buildAccount(credentialId: string) {
    const xhr = this.buildXhr(credentialId);
    const client = new dav.Client(xhr);
    const server = this.getServer(credentialId);
    const account = await client.createAccount({
      server,
      accountType: "caldav",
      loadObjects: true
    });
    return account;
  }


  // ── intern ────────────────────────────────────────────────────────────────
  private getCredentialsOrThrow(credentialId: string): StoredCredentials {
    const c = this.repo.findById(credentialId);
    if (!c?.username) throw new Error("CalDAV username ist nicht gesetzt");
    if (!c?.password) throw new Error("CalDAV password ist nicht gesetzt");
    return c;
  }

  
}


