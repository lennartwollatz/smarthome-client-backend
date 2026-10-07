import { z } from "zod";
import { deviceIdParams } from "../common.js";

export const weatherValidation = {
  refreshDevice: z.object({ params: deviceIdParams }),
  updateCoordinates: z.object({
    params: deviceIdParams,
    body: z.object({
      latitude: z.number().nullish(),
      longitude: z.number().nullish()
    })
  })
};
