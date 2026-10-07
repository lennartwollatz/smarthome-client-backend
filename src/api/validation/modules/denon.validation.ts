import { z } from "zod";
import { booleanish, deviceIdParams, numberish } from "../common.js";

export const denonValidation = {
  discoverDevices: z.object({}),
  setVolume: z.object({ params: deviceIdParams, body: z.object({ volume: numberish.nullish() }) }),
  setOn: z.object({ params: deviceIdParams }),
  setOff: z.object({ params: deviceIdParams }),
  setPlayState: z.object({ params: deviceIdParams, body: z.object({ state: z.string().nullish() }) }),
  setMute: z.object({ params: deviceIdParams, body: z.object({ mute: booleanish.nullish() }) }),
  playNext: z.object({ params: deviceIdParams }),
  playPrevious: z.object({ params: deviceIdParams }),
  setVolumeStart: z.object({ params: deviceIdParams, body: z.object({ volumeStart: numberish.nullish() }) }),
  setVolumeMax: z.object({ params: deviceIdParams, body: z.object({ volumeMax: numberish.nullish() }) }),
  setSource: z.object({
    params: deviceIdParams,
    body: z.object({ sourceIndex: z.string().trim().nullish(), selected: booleanish.nullish() })
  }),
  setZonePower: z.object({
    params: deviceIdParams,
    body: z.object({ zoneName: z.string().trim().nullish(), power: booleanish.nullish() })
  })
};
