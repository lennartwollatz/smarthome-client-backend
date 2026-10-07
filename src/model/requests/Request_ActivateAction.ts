/** POST /api/actions/:actionId/activate */
export class Request_ActivateAction {
  readonly actionId!: string;

  constructor(fields: Request_ActivateAction) {
    Object.assign(this, fields);
  }
}
