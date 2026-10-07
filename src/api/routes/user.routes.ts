import { Router } from "express";
import { UserRepository } from "../../db/repositories/UserRepository.js";
import { Request_CreateUser } from "../../model/requests/Request_CreateUser.js";
import { Request_DeleteUser } from "../../model/requests/Request_DeleteUser.js";
import { Request_GetUser } from "../../model/requests/Request_GetUser.js";
import { Request_GetUsers } from "../../model/requests/Request_GetUsers.js";
import { Request_RegenerateUserTrackingToken } from "../../model/requests/Request_RegenerateUserTrackingToken.js";
import { Request_UpdateUser } from "../../model/requests/Request_UpdateUser.js";
import { endpoint } from "../http/endpoint.js";
import { UserService } from "../services/user.service.js";
import { userValidation } from "../validation/user.validation.js";
import type { RouterDeps } from "../router.js";

export function createUserRouter(deps: RouterDeps) {
  const router = Router();
  const userService = new UserService(new UserRepository(deps.databaseManager), deps.presenceManager);

  router.get("/", ...endpoint({
    schema: userValidation.getUsers,
    toRequest: () => new Request_GetUsers(),
    serve: request => userService.getUsers(request)
  }));

  router.post("/", ...endpoint({
    schema: userValidation.createUser,
    toRequest: ({ body }) => new Request_CreateUser(body),
    serve: request => userService.createUser(request),
    status: 201
  }));

  router.get("/:userId", ...endpoint({
    schema: userValidation.getUser,
    toRequest: ({ params }) => new Request_GetUser(params),
    serve: request => userService.getUser(request)
  }));

  router.put("/:userId", ...endpoint({
    schema: userValidation.updateUser,
    toRequest: ({ params, body }) => new Request_UpdateUser({ ...body, userId: params.userId }),
    serve: request => userService.updateUser(request)
  }));

  router.delete("/:userId", ...endpoint({
    schema: userValidation.deleteUser,
    toRequest: ({ params }) => new Request_DeleteUser(params),
    serve: request => userService.deleteUser(request),
    status: 204
  }));

  router.get("/:userId/regenerate-token", ...endpoint({
    schema: userValidation.regenerateTrackingToken,
    toRequest: ({ params }) => new Request_RegenerateUserTrackingToken(params),
    serve: request => userService.regenerateTrackingToken(request)
  }));

  return router;
}
