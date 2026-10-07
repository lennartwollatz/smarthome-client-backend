import { z } from "zod";
import { deviceIdParams } from "./common.js";

const deviceButtonBody = z.object({
  name: z.string().nullish(),
  connectedToLight: z.boolean().nullish()
});

/** Nur die änderbaren Felder; das Frontend sendet das vollständige Gerät, der Rest wird entfernt. */
const deviceBody = z.object({
  name: z.string().nullish(),
  room: z.string().nullish(),
  icon: z.string().nullish(),
  typeLabel: z.string().nullish(),
  quickAccess: z.boolean().nullish(),
  temperatureGoal: z.number().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  roomMapping: z.record(z.string(), z.string()).nullish(),
  buttons: z.record(z.string(), deviceButtonBody).nullish()
});

export const deviceValidation = {
  getDevices: z.object({}),
  deleteDevice: z.object({ params: deviceIdParams }),
  updateDevice: z.object({ params: deviceIdParams, body: deviceBody })
};
