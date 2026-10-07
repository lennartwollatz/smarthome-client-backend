/** GET /api/actions/:actionId */
export class Request_GetAction {
  readonly actionId!: string;

  constructor(fields: Request_GetAction) {
    Object.assign(this, fields);
  }
}
