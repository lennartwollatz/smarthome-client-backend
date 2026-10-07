/** DELETE /api/actions/:actionId/voice-assistant */
export class Request_DeleteActionVoiceAssistant {
  readonly actionId!: string;

  constructor(fields: Request_DeleteActionVoiceAssistant) {
    Object.assign(this, fields);
  }
}
