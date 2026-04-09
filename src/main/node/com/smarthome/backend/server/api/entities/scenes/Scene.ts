export class Scene {
  id?: string;
  name?: string;
  icon?: string;
  active?: boolean;
  description?: string;
  /** Aktionen, die ausgeführt werden, wenn die Szene aktiviert wird. */
  actionIds?: string[];
  /** Aktionen, die ausgeführt werden, wenn die Szene deaktiviert wird. */
  deactivateActionIds?: string[];
  showOnHome?: boolean; // Whether this scene should be displayed on the home screen
  isCustom?: boolean; // Whether this is a user-created custom scene (not a predefined one)

  constructor(init?: Partial<Scene>) {
    Object.assign(this, init);
  }

  /** Alle Aktionen-IDs, die dieser Szene zugeordnet sind (für Listener-Bereinigung beim Löschen). */
  static allReferencedActionIds(scene: Scene): string[] {
    const on = scene.actionIds ?? [];
    const off = scene.deactivateActionIds ?? [];
    return [...new Set([...on, ...off])];
  }
}
