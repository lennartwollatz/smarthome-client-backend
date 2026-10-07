import { z } from "zod";
import { deviceIdParams, numberish } from "../common.js";

const bridgeIdParams = z.object({
  bridgeId: z.string().min(1)
});

/** Zahl oder numerischer String; fehlende oder ungültige Werte werden `null`, der Service meldet dann den Pflichtparameter. */
const lenientNumber = numberish.nullish().catch(null);

export const hueValidation = {
  getBridges: z.object({}),
  discoverBridges: z.object({}),
  pairBridge: z.object({ params: bridgeIdParams }),
  discoverBridgeDevices: z.object({ params: bridgeIdParams }),
  setSensitivity: z.object({ params: deviceIdParams, body: z.object({ sensitivity: lenientNumber }) }),
  setOn: z.object({ params: deviceIdParams }),
  setOff: z.object({ params: deviceIdParams }),
  setBrightness: z.object({ params: deviceIdParams, body: z.object({ brightness: lenientNumber }) }),
  setTemperature: z.object({ params: deviceIdParams, body: z.object({ temperature: lenientNumber }) }),
  setColor: z.object({ params: deviceIdParams, body: z.object({ x: lenientNumber, y: lenientNumber }) })
};
