/** POST /api/actions/:actionId/voice-assistant – angelegtes Sprachassistent-Gerät. */
export class Response_CreateActionVoiceAssistant {
  constructor(
    readonly deviceId: string,
    readonly pairingCode: string
  ) {}
}
