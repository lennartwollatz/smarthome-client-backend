import { randomUUID } from "node:crypto";
import type { ActionManager } from "../../actions/ActionManager.js";
import { Scene } from "../../actions/scene/Scene.js";
import type { Request_ActivateScene } from "../../model/requests/Request_ActivateScene.js";
import type { Request_CreateScene } from "../../model/requests/Request_CreateScene.js";
import type { Request_DeactivateScene } from "../../model/requests/Request_DeactivateScene.js";
import type { Request_DeleteScene } from "../../model/requests/Request_DeleteScene.js";
import type { Request_GetScene } from "../../model/requests/Request_GetScene.js";
import type { Request_GetScenes } from "../../model/requests/Request_GetScenes.js";
import type { Request_UpdateScene } from "../../model/requests/Request_UpdateScene.js";
import { Response_ActivateScene } from "../../model/responses/Response_ActivateScene.js";
import { Response_CreateScene } from "../../model/responses/Response_CreateScene.js";
import { Response_DeactivateScene } from "../../model/responses/Response_DeactivateScene.js";
import { Response_DeleteScene } from "../../model/responses/Response_DeleteScene.js";
import { Response_GetScene } from "../../model/responses/Response_GetScene.js";
import { Response_GetScenes } from "../../model/responses/Response_GetScenes.js";
import { Response_UpdateScene } from "../../model/responses/Response_UpdateScene.js";
import { ApiError } from "../http/ApiError.js";

const SCENE_NOT_FOUND = "Scene not found";

export class SceneService {
  constructor(private readonly actionManager: ActionManager) {}

  getScenes(_request: Request_GetScenes): Response_GetScenes {
    return new Response_GetScenes(this.actionManager.getScenes());
  }

  getScene(request: Request_GetScene): Response_GetScene {
    return new Response_GetScene(this.requireScene(request.sceneId));
  }

  createScene(request: Request_CreateScene): Response_CreateScene {
    const scene = new Scene({
      id: request.id || `scene-${randomUUID()}`,
      name: request.name ?? undefined,
      icon: request.icon ?? undefined,
      active: request.active ?? false,
      description: request.description ?? undefined,
      actionIds: request.actionIds ?? undefined,
      showOnHome: request.showOnHome ?? undefined,
      isCustom: request.isCustom ?? undefined
    });

    if (!this.actionManager.addScene(scene)) {
      throw ApiError.badRequest(`Invalid scene data: ${scene.id}`);
    }
    return new Response_CreateScene(scene);
  }

  updateScene(request: Request_UpdateScene): Response_UpdateScene {
    const scene = new Scene({
      id: request.sceneId,
      name: request.name ?? undefined,
      icon: request.icon ?? undefined,
      active: request.active ?? undefined,
      description: request.description ?? undefined,
      actionIds: request.actionIds ?? undefined,
      showOnHome: request.showOnHome ?? undefined,
      isCustom: request.isCustom ?? undefined
    });

    if (!this.actionManager.updateScene(scene)) {
      throw ApiError.badRequest(`Invalid scene data: ${scene.id}`);
    }
    return new Response_UpdateScene(scene);
  }

  deleteScene(request: Request_DeleteScene): Response_DeleteScene {
    if (!this.actionManager.deleteScene(request.sceneId)) {
      throw ApiError.notFound(SCENE_NOT_FOUND);
    }
    return new Response_DeleteScene();
  }

  activateScene(request: Request_ActivateScene): Response_ActivateScene {
    const scene = this.requireScene(request.sceneId);
    scene.active = true;
    this.actionManager.addScene(scene);
    return new Response_ActivateScene(scene);
  }

  deactivateScene(request: Request_DeactivateScene): Response_DeactivateScene {
    const scene = this.requireScene(request.sceneId);
    scene.active = false;
    this.actionManager.addScene(scene);
    return new Response_DeactivateScene(scene);
  }

  private requireScene(sceneId: string): Scene {
    const scene = this.actionManager.getScene(sceneId);
    if (!scene) throw ApiError.notFound(SCENE_NOT_FOUND);
    return scene;
  }
}
