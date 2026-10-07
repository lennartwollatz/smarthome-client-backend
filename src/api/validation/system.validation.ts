import { z } from "zod";
import { systemSettingsBody } from "./settings.validation.js";

export const systemValidation = {
  getSystemInfo: z.object({}),
  installUpdate: z.object({
    body: z.object({ component: z.enum(["frontend", "backend"]) })
  }),
  updateAutoUpdateSettings: z.object({ body: systemSettingsBody })
};
