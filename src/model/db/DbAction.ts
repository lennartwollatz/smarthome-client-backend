export const DB_ACTION_TRIGGER_TYPES = ["manual", "device", "time", "voice_assistant"] as const;
export type DbActionTriggerType = (typeof DB_ACTION_TRIGGER_TYPES)[number];

/** Zeile der Tabelle `actions`. */
export class DbAction {
  readonly id!: string;
  readonly name!: string;
  readonly triggerType!: DbActionTriggerType;
  readonly isActive!: boolean;
  readonly createdAt!: Date;
  readonly updatedAt!: Date;

  constructor(fields: DbAction) {
    Object.assign(this, fields);
  }
}
