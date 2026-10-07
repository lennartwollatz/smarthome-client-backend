import { z } from "zod";
import { deviceIdParams, numberish } from "../common.js";

export const waclightingValidation = {
  discoverDevices: z.object({}),
  fanSetOn: z.object({ params: deviceIdParams }),
  fanSetOff: z.object({ params: deviceIdParams }),
  fanSetSpeed: z.object({ params: deviceIdParams, body: z.object({ speed: numberish.nullish() }) }),
  lightSetOn: z.object({ params: deviceIdParams }),
  lightSetOff: z.object({ params: deviceIdParams }),
  lightSetBrightness: z.object({ params: deviceIdParams, body: z.object({ brightness: numberish.nullish() }) })
};
