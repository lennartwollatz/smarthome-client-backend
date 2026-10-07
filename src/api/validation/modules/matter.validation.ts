import { z } from "zod";
import { deviceIdParams, numberish } from "../common.js";

const buttonParams = deviceIdParams.extend({
  buttonId: z.string().min(1)
});

const pairingBody = z.object({
  pairingCode: z.string()
});

const temperatureSchedule = z.object({
  rulename: z.string(),
  rulevalue: z.array(z.object({
    weekday: z.number(),
    time: z.string(),
    temperature: z.number()
  })),
  active: z.boolean()
});

export const matterValidation = {
  discoverDevices: z.object({}),
  pairDevice: z.object({ params: deviceIdParams, body: pairingBody }),
  pairDeviceByCode: z.object({ body: pairingBody }),
  toggle: z.object({ params: buttonParams }),
  setOn: z.object({ params: buttonParams }),
  setOff: z.object({ params: buttonParams }),
  setIntensity: z.object({ params: buttonParams, body: z.object({ intensity: numberish.nullish() }) }),
  setTemperature: z.object({
    params: deviceIdParams,
    body: z.object({ temperature: numberish.nullish(), temperatureGoal: numberish.nullish() })
  }),
  setTemperatureSchedules: z.object({
    params: deviceIdParams,
    body: z.object({ temperatureSchedules: z.array(temperatureSchedule).nullish() })
  })
};
