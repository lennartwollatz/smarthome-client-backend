/** Zeile der Tabelle `module_oauth_tokens`. */
export class DbModuleOAuthToken {
  readonly moduleId!: string;
  readonly accessToken!: string;
  readonly refreshToken!: string;
  readonly validUntil!: Date;
  readonly rawResponse!: string | null;

  constructor(fields: DbModuleOAuthToken) {
    Object.assign(this, fields);
  }
}
