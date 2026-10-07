export class ConditionConfig {
  deviceId?: string;
  moduleId?: string;
  property?: string;
  values?: Object[];

  constructor(init?: Partial<ConditionConfig>) {
    Object.assign(this, init);
  }
}
