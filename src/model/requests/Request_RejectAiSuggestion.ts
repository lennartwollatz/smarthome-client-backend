/** POST /api/actions/:actionId/reject – KI-Vorschlag verwerfen. */
export class Request_RejectAiSuggestion {
  readonly actionId!: string;

  constructor(fields: Request_RejectAiSuggestion) {
    Object.assign(this, fields);
  }
}
