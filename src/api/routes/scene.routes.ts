import { Router } from "express";
import { Request_ActivateScene } from "../../model/requests/Request_ActivateScene.js";
import { Request_CreateScene } from "../../model/requests/Request_CreateScene.js";
import { Request_DeactivateScene } from "../../model/requests/Request_DeactivateScene.js";
import { Request_DeleteScene } from "../../model/requests/Request_DeleteScene.js";
import { Request_GetScene } from "../../model/requests/Request_GetScene.js";
import { Request_GetScenes } from "../../model/requests/Request_GetScenes.js";
import { Request_UpdateScene } from "../../model/requests/Request_UpdateScene.js";
import { endpoint } from "../http/endpoint.js";
import { SceneService } from "../services/scene.service.js";
import { sceneValidation } from "../validation/scene.validation.js";
import type { RouterDeps } from "../router.js";

export function createSceneRouter(deps: RouterDeps) {
  const router = Router();
  const sceneService = new SceneService(deps.actionManager);

  router.get("/", ...endpoint({
    schema: sceneValidation.getScenes,
    toRequest: () => new Request_GetScenes(),
    serve: request => sceneService.getScenes(request)
  }));

  router.post("/", ...endpoint({
    schema: sceneValidation.createScene,
    toRequest: ({ body }) => new Request_CreateScene(body),
    serve: request => sceneService.createScene(request)
  }));

  router.get("/:sceneId", ...endpoint({
    schema: sceneValidation.getScene,
    toRequest: ({ params }) => new Request_GetScene(params),
    serve: request => sceneService.getScene(request)
  }));

  router.put("/:sceneId", ...endpoint({
    schema: sceneValidation.updateScene,
    toRequest: ({ params, body }) => new Request_UpdateScene({ ...body, sceneId: params.sceneId }),
    serve: request => sceneService.updateScene(request)
  }));

  router.delete("/:sceneId", ...endpoint({
    schema: sceneValidation.deleteScene,
    toRequest: ({ params }) => new Request_DeleteScene(params),
    serve: request => sceneService.deleteScene(request),
    status: 204
  }));

  router.post("/:sceneId/activate", ...endpoint({
    schema: sceneValidation.activateScene,
    toRequest: ({ params }) => new Request_ActivateScene(params),
    serve: request => sceneService.activateScene(request)
  }));

  router.post("/:sceneId/deactivate", ...endpoint({
    schema: sceneValidation.deactivateScene,
    toRequest: ({ params }) => new Request_DeactivateScene(params),
    serve: request => sceneService.deactivateScene(request)
  }));

  return router;
}
