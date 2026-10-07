import { z } from "zod";
import { deviceIdParams } from "../common.js";

export const presenceValidation = {
  setPresent: z.object({ params: deviceIdParams }),
  setAbsent: z.object({ params: deviceIdParams }),
  togglePresence: z.object({ params: deviceIdParams })
};
