import { JsonRepository } from "../../../db/jsonRepository.js";
import type { DatabaseManager } from "../../../db/database.js";

const BMW_CREDENTIALS_ID = "bmw";

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
  private repository: JsonRepository<BMWCredentialsPersisted>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new JsonRepository<BMWCredentialsPersisted>(databaseManager, "BMWCredentials");
  }

  getCredentials(): BMWCredentialsPersisted {
    return this.repository.findById(BMW_CREDENTIALS_ID) ?? {};
  }

  setUsername(username: string) {
    const current = this.getCredentials();
    this.repository.save(BMW_CREDENTIALS_ID, {
      ...current,
      username
    });
  }

  setPassword(password: string) {
    const current = this.getCredentials();
    this.repository.save(BMW_CREDENTIALS_ID, {
      ...current,
      password
    });
  }

  setCaptchaToken(captchaToken: string) {
    const current = this.getCredentials();
    this.repository.save(BMW_CREDENTIALS_ID, {
      ...current,
      captchaToken
    });
  }

  clearCaptchaToken() {
    const current = this.getCredentials();
    const { captchaToken: _captchaToken, ...rest } = current;
    this.repository.save(BMW_CREDENTIALS_ID, rest);
  }

  hasPassword(): boolean {
    const current = this.getCredentials();
    return typeof current.password === "string" && current.password.length > 0;
  }

  hasCaptchaToken(): boolean {
    const current = this.getCredentials();
    return typeof current.captchaToken === "string" && current.captchaToken.length > 0;
  }

  canDiscover(): boolean {
    const current = this.getCredentials();
    return Boolean(current.username && current.password);
  }
}

