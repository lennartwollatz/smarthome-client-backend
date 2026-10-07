import { CredentialsRepository, type ModuleCredentials } from "../../db/repositories/CredentialsRepository.js";
import type { DatabaseManager } from "../../db/database.js";
import { logger } from "../../config/logger.js";
import { BMWCONFIG } from "./bmwModule.js";

const BMW_CREDENTIALS_ID = "default";

export interface BMWCredentials {
  username: string;
  password?: string;
  captchaToken?: string;
}

type BMWCredentialsPersisted = {
  username?: string;
  password?: string;
  captchaToken?: string;
};

export class BMWCredentialsStore {
  private repository: CredentialsRepository;
  private cache: BMWCredentialsPersisted = {};

  constructor(databaseManager: DatabaseManager) {
    this.repository = new CredentialsRepository(databaseManager, BMWCONFIG.id);
  }

  async hydrate(): Promise<void> {
    const stored = await this.repository.findById(BMW_CREDENTIALS_ID);
    this.cache = {
      username: stored?.username,
      password: stored?.password,
      captchaToken: stored?.captchaToken
    };
  }

  getCredentials(): BMWCredentialsPersisted {
    return { ...this.cache };
  }

  private persist(next: BMWCredentialsPersisted): void {
    this.cache = { ...next };
    const credentials: ModuleCredentials = { id: BMW_CREDENTIALS_ID, ...this.cache };
    void this.repository.save(credentials).catch(err => {
      logger.error({ err }, "BMW-Credentials konnten nicht gespeichert werden");
    });
  }

  setUsername(username: string) {
    this.persist({ ...this.cache, username });
  }

  setPassword(password: string) {
    this.persist({ ...this.cache, password });
  }

  setCaptchaToken(captchaToken: string) {
    this.persist({ ...this.cache, captchaToken });
  }

  clearCaptchaToken() {
    const { captchaToken: _captchaToken, ...rest } = this.cache;
    this.persist(rest);
  }

  hasPassword(): boolean {
    return typeof this.cache.password === "string" && this.cache.password.length > 0;
  }

  hasCaptchaToken(): boolean {
    return typeof this.cache.captchaToken === "string" && this.cache.captchaToken.length > 0;
  }

  canDiscover(): boolean {
    return Boolean(this.cache.username && this.cache.password);
  }
}
