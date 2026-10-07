/** POST /api/actions/:actionId/deactivate */
export class Request_DeactivateAction {
  readonly actionId!: string;

  constructor(fields: Request_DeactivateAction) {
    Object.assign(this, fields);
  }
}
