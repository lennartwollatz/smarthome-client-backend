/** Zeile der Tabelle `module_credentials`. */
export class DbModuleCredential {
  readonly moduleId!: string;
  readonly id!: string;
  readonly username!: string | null;
  readonly password!: string | null;
  readonly serverUrl!: string | null;
  readonly captchaToken!: string | null;

  constructor(fields: DbModuleCredential) {
    Object.assign(this, fields);
  }
}
