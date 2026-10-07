/** POST /api/modules/:moduleId */
export class Request_SetModuleActive {
  readonly moduleId!: string;
  readonly isActive?: boolean | null;

  constructor(fields: Request_SetModuleActive) {
    Object.assign(this, fields);
  }
}
