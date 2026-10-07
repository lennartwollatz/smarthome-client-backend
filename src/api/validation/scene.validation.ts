import { z } from "zod";

const sceneIdParams = z.object({
  sceneId: z.string().min(1)
});

const sceneBody = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  icon: z.string().nullish(),
  active: z.boolean().nullish(),
  description: z.string().nullish(),
  actionIds: z.array(z.string()).nullish(),
  showOnHome: z.boolean().nullish(),
  isCustom: z.boolean().nullish()
});

export const sceneValidation = {
  getScenes: z.object({}),
  createScene: z.object({ body: sceneBody }),
  getScene: z.object({ params: sceneIdParams }),
  updateScene: z.object({ params: sceneIdParams, body: sceneBody.omit({ id: true }) }),
  deleteScene: z.object({ params: sceneIdParams }),
  activateScene: z.object({ params: sceneIdParams }),
  deactivateScene: z.object({ params: sceneIdParams })
};
