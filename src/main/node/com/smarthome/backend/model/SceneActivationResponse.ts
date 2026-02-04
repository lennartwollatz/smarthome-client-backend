export class SceneActivationResponse {
  id?: string;
  name?: string;
  active?: boolean;

  constructor(init?: Partial<SceneActivationResponse>) {
    Object.assign(this, init);
  }
}
