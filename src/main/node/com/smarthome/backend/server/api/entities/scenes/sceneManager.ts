import { Scene } from "./Scene.js";
import { STANDARD_SCENE_DEFINITIONS } from "./sceneDefinitions.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import type { LiveUpdateService } from "../../services/live.service.js";
import type { EntityManager } from "../EntityManager.js";
import { EventManager } from "../../../events/EventManager.js";

export class SceneManager implements EntityManager {
  private sceneRepository: JsonRepository<Scene>;
  private liveUpdateService?: LiveUpdateService;
  private scenes = new Map<string, Scene>();

  constructor(databaseManager: DatabaseManager, private eventManager: EventManager) {
    this.sceneRepository = new JsonRepository<Scene>(databaseManager, "Scene");
    this.initialize();
  }

  initialize() {
    this.loadScenesFromDatabase();
  }

  setLiveUpdateService(service: LiveUpdateService): void {
    this.liveUpdateService = service;
  }

  loadScenesFromDatabase(): void {
    const scenes = this.sceneRepository.findAll();
    const existingSceneIds = new Set<string>();

    scenes.forEach(scene => {
      if (scene?.id) {
        this.scenes.set(scene.id, scene);
        existingSceneIds.add(scene.id);
      }
    });

    this.initializeStandardScenes(existingSceneIds);
  }

  private initializeStandardScenes(existingSceneIds: Set<string>): void {
    STANDARD_SCENE_DEFINITIONS.forEach(def => {
      if (!existingSceneIds.has(def.id)) {
        const standardScene = new Scene({
          id: def.id,
          name: def.name,
          icon: def.icon,
          active: false,
          actionIds: [],
          deactivateActionIds: [],
          showOnHome: def.showOnHome ?? true,
          isCustom: def.isCustom ?? false,
        });

        this.scenes.set(def.id, standardScene);
        this.sceneRepository.save(def.id, standardScene);
      }
    });
  }

  getScenesMap(): Map<string, Scene> {
    return this.scenes;
  }

  getScenes(): Scene[] {
    return Array.from(this.scenes.values());
  }

  getScene(sceneId: string): Scene | null {
    return this.scenes.get(sceneId) ?? null;
  }

  addScene(scene: Scene): boolean {
    if (!scene?.id) return false;
    this.scenes.set(scene.id, scene);
    this.sceneRepository.save(scene.id, scene);
    this.liveUpdateService?.emit("scene:updated", scene);
    return true;
  }

  updateScene(scene: Scene): boolean {
    if (!scene?.id) return false;
    this.scenes.set(scene.id, scene);
    this.sceneRepository.save(scene.id, scene);
    this.liveUpdateService?.emit("scene:updated", scene);
    return true;
  }

  deleteScene(sceneId: string): boolean {
    const scene = this.scenes.get(sceneId);
    if (!scene) return false;
    this.scenes.delete(sceneId);
    this.sceneRepository.deleteById(sceneId);
    this.eventManager.removeListenerForScene(Scene.allReferencedActionIds(scene));
    this.liveUpdateService?.emit("scene:removed", { sceneId });
    return true;
  }

  /**
   * Entfernt eine Action-ID aus allen Szenen (Aktivierung und Deaktivierung), speichert und sendet Live-Updates.
   */
  removeActionIdFromAllScenes(actionId: string): void {
    const id = String(actionId ?? "").trim();
    if (!id) return;
    for (const scene of this.scenes.values()) {
      if (!scene?.id) continue;
      const on = scene.actionIds ?? [];
      const off = scene.deactivateActionIds ?? [];
      const nextOn = on.filter((x) => x !== id);
      const nextOff = off.filter((x) => x !== id);
      if (nextOn.length === on.length && nextOff.length === off.length) {
        continue;
      }
      scene.actionIds = nextOn;
      scene.deactivateActionIds = nextOff;
      this.updateScene(scene);
    }
  }
}
