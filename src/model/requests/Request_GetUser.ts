/** GET /api/users/:userId */
export class Request_GetUser {
  readonly userId!: string;

  constructor(fields: Request_GetUser) {
    Object.assign(this, fields);
  }
}
