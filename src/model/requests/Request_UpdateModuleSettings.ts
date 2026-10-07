/** PUT /api/modules/:moduleId/settings – der Body wird nicht ausgewertet. */
export class Request_UpdateModuleSettings {
  readonly moduleId!: string;

  constructor(fields: Request_UpdateModuleSettings) {
    Object.assign(this, fields);
  }
}
