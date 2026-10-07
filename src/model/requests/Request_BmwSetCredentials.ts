/** PUT /api/modules/bmw/credentials */
export class Request_BmwSetCredentials {
  readonly username!: string;
  readonly password?: string | null;
  readonly captchaToken?: string | null;

  constructor(fields: Request_BmwSetCredentials) {
    Object.assign(this, fields);
  }
}
