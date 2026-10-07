import { z } from "zod";
import { deviceIdParams, numberish } from "../common.js";

export const bmwValidation = {
  getCredentials: z.object({}),
  setCredentials: z.object({
    body: z.object({
      username: z.string().trim().min(1),
      password: z.string().nullish(),
      captchaToken: z.string().nullish()
    })
  }),
  setPassword: z.object({ body: z.object({ password: z.string().min(1) }) }),
  setCaptchaToken: z.object({ body: z.object({ captchaToken: z.string().min(1) }) }),
  discoverDevices: z.object({}),
  startClimateControl: z.object({ params: deviceIdParams }),
  stopClimateControl: z.object({ params: deviceIdParams }),
  sendAddress: z.object({
    params: deviceIdParams,
    body: z.object({
      subject: z.string().trim().nullish(),
      name: z.string().trim().min(1),
      latitude: numberish,
      longitude: numberish
    })
  }),
  refreshDevice: z.object({ params: deviceIdParams })
};
