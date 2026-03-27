export class Scene {
  id?: string;
  name?: string;
  icon?: string;
  active?: boolean;
  description?: string;
  actionIds?: string[];
  showOnHome?: boolean; // Whether this scene should be displayed on the home screen
  isCustom?: boolean; // Whether this is a user-created custom scene (not a predefined one)

  constructor(init?: Partial<Scene>) {
    Object.assign(this, init);
  }
}
