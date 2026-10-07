/** GET /api/users/:userId/regenerate-token */
export class Request_RegenerateUserTrackingToken {
  readonly userId!: string;

  constructor(fields: Request_RegenerateUserTrackingToken) {
    Object.assign(this, fields);
  }
}
