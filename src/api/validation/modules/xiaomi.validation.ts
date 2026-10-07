import { z } from "zod";
import { deviceIdParams, numberish } from "../common.js";

export const xiaomiValidation = {
  discoverDevices: z.object({}),
  addDevice: z.object({
    body: z.object({
      ipAddress: z.string().trim().min(1),
      token: z.string().trim().min(1)
    })
  }),
  startCleaning: z.object({ params: deviceIdParams }),
  stopCleaning: z.object({ params: deviceIdParams }),
  dock: z.object({ params: deviceIdParams }),
  getRoomMapping: z.object({ params: deviceIdParams }),
  navigateToRoom: z.object({
    params: deviceIdParams,
    body: z.object({ roomId: numberish })
  })
};
