/** PUT /api/modules/:moduleId – vollständiges Modul; die ID kommt aus dem Pfad. */
export class Request_UpdateModule {
  readonly moduleId!: string;
  readonly name!: string;
  readonly shortDescription!: string;
  readonly longDescription!: string;
  readonly categoryKey!: string;
  readonly icon!: string;
  readonly isInstalled?: boolean | null;
  readonly isActive?: boolean | null;
  readonly isPurchased?: boolean | null;
  readonly isDisabled?: boolean | null;
  readonly price!: number;
  readonly features?: unknown;
  readonly version!: string;
  readonly devices?: unknown;
  readonly moduleData?: Record<string, unknown> | null;

  constructor(fields: Request_UpdateModule) {
    Object.assign(this, fields);
  }
}
