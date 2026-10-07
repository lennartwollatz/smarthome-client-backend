import { Router } from "express";
import { Request_ActivateAction } from "../../model/requests/Request_ActivateAction.js";
import { Request_CreateAction } from "../../model/requests/Request_CreateAction.js";
import { Request_CreateActionVoiceAssistant } from "../../model/requests/Request_CreateActionVoiceAssistant.js";
import { Request_DeactivateAction } from "../../model/requests/Request_DeactivateAction.js";
import { Request_DeleteAction } from "../../model/requests/Request_DeleteAction.js";
import { Request_DeleteActionVoiceAssistant } from "../../model/requests/Request_DeleteActionVoiceAssistant.js";
import { Request_GetAction } from "../../model/requests/Request_GetAction.js";
import { Request_GetActions } from "../../model/requests/Request_GetActions.js";
import { Request_RejectAiSuggestion } from "../../model/requests/Request_RejectAiSuggestion.js";
import { Request_UpdateAction } from "../../model/requests/Request_UpdateAction.js";
import { endpoint } from "../http/endpoint.js";
import { ActionService } from "../services/action.service.js";
import { actionValidation } from "../validation/action.validation.js";
import type { RouterDeps } from "../router.js";

export function createActionRouter(deps: RouterDeps) {
  const router = Router();
  const actionService = new ActionService(deps.actionManager, deps.voiceAssistantManager);

  router.post("/:actionId/voice-assistant", ...endpoint({
    schema: actionValidation.createVoiceAssistant,
    toRequest: ({ params, body }) => new Request_CreateActionVoiceAssistant({ ...body, actionId: params.actionId }),
    serve: request => actionService.createVoiceAssistant(request)
  }));

  router.delete("/:actionId/voice-assistant", ...endpoint({
    schema: actionValidation.deleteVoiceAssistant,
    toRequest: ({ params }) => new Request_DeleteActionVoiceAssistant(params),
    serve: request => actionService.deleteVoiceAssistant(request)
  }));

  router.get("/", ...endpoint({
    schema: actionValidation.getActions,
    toRequest: () => new Request_GetActions(),
    serve: request => actionService.getActions(request)
  }));

  router.post("/", ...endpoint({
    schema: actionValidation.createAction,
    toRequest: ({ body }) => new Request_CreateAction(body),
    serve: request => actionService.createAction(request)
  }));

  router.get("/:actionId", ...endpoint({
    schema: actionValidation.getAction,
    toRequest: ({ params }) => new Request_GetAction(params),
    serve: request => actionService.getAction(request)
  }));

  router.put("/:actionId", ...endpoint({
    schema: actionValidation.updateAction,
    toRequest: ({ params, body }) => new Request_UpdateAction({ ...body, actionId: params.actionId }),
    serve: request => actionService.updateAction(request)
  }));

  router.delete("/:actionId", ...endpoint({
    schema: actionValidation.deleteAction,
    toRequest: ({ params }) => new Request_DeleteAction(params),
    serve: request => actionService.deleteAction(request)
  }));

  router.post("/:actionId/activate", ...endpoint({
    schema: actionValidation.activateAction,
    toRequest: ({ params }) => new Request_ActivateAction(params),
    serve: request => actionService.activateAction(request)
  }));

  router.post("/:actionId/deactivate", ...endpoint({
    schema: actionValidation.deactivateAction,
    toRequest: ({ params }) => new Request_DeactivateAction(params),
    serve: request => actionService.deactivateAction(request)
  }));

  router.post("/:actionId/reject", ...endpoint({
    schema: actionValidation.rejectAiSuggestion,
    toRequest: ({ params }) => new Request_RejectAiSuggestion(params),
    serve: request => actionService.rejectAiSuggestion(request)
  }));

  return router;
}
