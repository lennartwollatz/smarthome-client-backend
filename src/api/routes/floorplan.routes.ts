import { Router } from "express";
import { RoomRepository } from "../../db/repositories/RoomRepository.js";
import { Request_CreateFloorPlanRoom } from "../../model/requests/Request_CreateFloorPlanRoom.js";
import { Request_DeleteFloorPlanRoom } from "../../model/requests/Request_DeleteFloorPlanRoom.js";
import { Request_GetFloorPlan } from "../../model/requests/Request_GetFloorPlan.js";
import { Request_UpdateFloorPlan } from "../../model/requests/Request_UpdateFloorPlan.js";
import { Request_UpdateFloorPlanRoom } from "../../model/requests/Request_UpdateFloorPlanRoom.js";
import { endpoint } from "../http/endpoint.js";
import { FloorPlanService } from "../services/floorplan.service.js";
import { floorPlanValidation } from "../validation/floorplan.validation.js";
import type { RouterDeps } from "../router.js";

export function createFloorPlanRouter(deps: RouterDeps) {
  const router = Router();
  const floorPlanService = new FloorPlanService(new RoomRepository(deps.databaseManager), deps.actionManager);

  router.get("/", ...endpoint({
    schema: floorPlanValidation.getFloorPlan,
    toRequest: () => new Request_GetFloorPlan(),
    serve: request => floorPlanService.getFloorPlan(request)
  }));

  router.put("/", ...endpoint({
    schema: floorPlanValidation.updateFloorPlan,
    toRequest: ({ body }) => new Request_UpdateFloorPlan(body),
    serve: request => floorPlanService.updateFloorPlan(request)
  }));

  router.post("/rooms", ...endpoint({
    schema: floorPlanValidation.createRoom,
    toRequest: ({ body }) => new Request_CreateFloorPlanRoom(body),
    serve: request => floorPlanService.createRoom(request)
  }));

  router.put("/rooms/:roomId", ...endpoint({
    schema: floorPlanValidation.updateRoom,
    toRequest: ({ params, body }) => new Request_UpdateFloorPlanRoom({ ...body, roomId: params.roomId }),
    serve: request => floorPlanService.updateRoom(request)
  }));

  router.delete("/rooms/:roomId", ...endpoint({
    schema: floorPlanValidation.deleteRoom,
    toRequest: ({ params }) => new Request_DeleteFloorPlanRoom(params),
    serve: request => floorPlanService.deleteRoom(request),
    status: 204
  }));

  return router;
}
