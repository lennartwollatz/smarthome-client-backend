/** Zeile der Tabelle `action_node_trigger_voice_assistants`. */
export class DbActionNodeTriggerVoiceAssistant {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly keyword!: string | null;
  readonly actionType!: string | null;
  readonly deviceId!: string | null;
  readonly pairingCode!: string | null;

  constructor(fields: DbActionNodeTriggerVoiceAssistant) {
    Object.assign(this, fields);
  }
}
