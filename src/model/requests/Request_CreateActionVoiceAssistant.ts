/** POST /api/actions/:actionId/voice-assistant */
export class Request_CreateActionVoiceAssistant {
  readonly actionId!: string;
  readonly keyword!: string;

  constructor(fields: Request_CreateActionVoiceAssistant) {
    Object.assign(this, fields);
  }
}
