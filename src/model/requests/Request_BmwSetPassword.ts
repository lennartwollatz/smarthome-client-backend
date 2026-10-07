/** PUT /api/modules/bmw/credentials/password */
export class Request_BmwSetPassword {
  readonly password!: string;

  constructor(fields: Request_BmwSetPassword) {
    Object.assign(this, fields);
  }
}
