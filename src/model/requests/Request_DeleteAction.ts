/** DELETE /api/actions/:actionId */
export class Request_DeleteAction {
  readonly actionId!: string;

  constructor(fields: Request_DeleteAction) {
    Object.assign(this, fields);
  }
}
