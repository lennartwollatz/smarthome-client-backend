/** GET /api/config/public – öffentliche Laufzeitkonfiguration für das Frontend. */
export class Response_GetPublicConfig {
  constructor(readonly hcaptchaSiteKey: string) {}
}
