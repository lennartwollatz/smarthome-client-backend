/** PUT /api/modules/bmw/credentials/captchaToken */
export class Request_BmwSetCaptchaToken {
  readonly captchaToken!: string;

  constructor(fields: Request_BmwSetCaptchaToken) {
    Object.assign(this, fields);
  }
}
