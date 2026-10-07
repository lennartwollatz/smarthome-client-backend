/** GET /api/users/:userId/regenerate-token – Antwort ist der neue Token als JSON-String. */
export class Response_RegenerateUserTrackingToken {
  constructor(readonly trackingToken: string) {}

  toJSON(): string {
    return this.trackingToken;
  }
}
