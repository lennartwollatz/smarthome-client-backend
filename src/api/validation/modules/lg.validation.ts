import { z } from "zod";
import { deviceIdParams, numberish } from "../common.js";

export const lgValidation = {
  discoverDevices: z.object({}),
  pair: z.object({ params: deviceIdParams }),
  setOn: z.object({ params: deviceIdParams }),
  setOff: z.object({ params: deviceIdParams }),
  setVolume: z.object({ params: deviceIdParams, body: z.object({ volume: numberish.nullish() }) }),
  screenOn: z.object({ params: deviceIdParams }),
  screenOff: z.object({ params: deviceIdParams }),
  setChannel: z.object({ params: deviceIdParams, body: z.object({ channelId: z.string().nullish() }) }),
  startApp: z.object({ params: deviceIdParams, body: z.object({ appId: z.string().nullish() }) }),
  notify: z.object({ params: deviceIdParams, body: z.object({ message: z.string().nullish() }) }),
  getChannels: z.object({ params: deviceIdParams }),
  getApps: z.object({ params: deviceIdParams }),
  getSelectedApp: z.object({ params: deviceIdParams }),
  getSelectedChannel: z.object({ params: deviceIdParams }),
  setHomeAppNumber: z.object({
    params: deviceIdParams,
    body: z.object({ appId: z.string().nullish(), homeAppNumber: numberish.nullish() })
  }),
  setHomeChannelNumber: z.object({
    params: deviceIdParams,
    body: z.object({ channelId: z.string().nullish(), homeChannelNumber: numberish.nullish() })
  })
};
