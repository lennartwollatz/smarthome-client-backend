import { z } from "zod";

const roomIdParams = z.object({
  roomId: z.string().min(1)
});

const roomPoint = z.object({
  x: z.number().nullish(),
  y: z.number().nullish()
});

const roomBody = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  icon: z.string().nullish(),
  color: z.string().nullish(),
  temperature: z.number().nullish(),
  x: z.number().nullish(),
  y: z.number().nullish(),
  width: z.number().nullish(),
  height: z.number().nullish(),
  index: z.number().nullish(),
  points: z.array(roomPoint).nullish()
});

export const floorPlanValidation = {
  getFloorPlan: z.object({}),
  updateFloorPlan: z.object({ body: z.object({ rooms: z.array(roomBody).nullish() }) }),
  createRoom: z.object({ body: roomBody }),
  updateRoom: z.object({ params: roomIdParams, body: roomBody.omit({ id: true }) }),
  deleteRoom: z.object({ params: roomIdParams })
};
