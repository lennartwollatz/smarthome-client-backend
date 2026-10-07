/** DELETE /api/users/:userId */
export class Request_DeleteUser {
  readonly userId!: string;

  constructor(fields: Request_DeleteUser) {
    Object.assign(this, fields);
  }
}
