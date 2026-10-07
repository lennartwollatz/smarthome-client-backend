import { z } from "zod";
import { booleanish, deviceIdParams, numberish } from "../common.js";

export const sonosValidation = {
  discoverDevices: z.object({}),
  setVolume: z.object({ params: deviceIdParams, body: z.object({ volume: numberish.nullish() }) }),
  setOn: z.object({ params: deviceIdParams }),
  setOff: z.object({ params: deviceIdParams }),
  setPlayState: z.object({ params: deviceIdParams, body: z.object({ state: z.string().nullish() }) }),
  setMute: z.object({ params: deviceIdParams, body: z.object({ mute: booleanish.nullish() }) }),
  playNext: z.object({ params: deviceIdParams }),
  playPrevious: z.object({ params: deviceIdParams })
};
