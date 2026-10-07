import { z } from "zod";

const moduleIdParams = z.object({
  moduleId: z.string().min(1)
});

const moduleBody = z.object({
  name: z.string(),
  shortDescription: z.string(),
  longDescription: z.string(),
  categoryKey: z.string(),
  icon: z.string(),
  isInstalled: z.boolean().nullish(),
  isActive: z.boolean().nullish(),
  isPurchased: z.boolean().nullish(),
  isDisabled: z.boolean().nullish(),
  price: z.number(),
  features: z.unknown().optional(),
  version: z.string(),
  devices: z.unknown().optional(),
  moduleData: z.record(z.string(), z.unknown()).nullish()
});

export const moduleValidation = {
  getModules: z.object({}),
  installModule: z.object({ params: moduleIdParams }),
  uninstallModule: z.object({ params: moduleIdParams }),
  updateModuleSettings: z.object({ params: moduleIdParams }),
  getModule: z.object({ params: moduleIdParams }),
  updateModule: z.object({ params: moduleIdParams, body: moduleBody }),
  setModuleActive: z.object({
    params: moduleIdParams,
    body: z.object({ isActive: z.boolean().nullish() })
  })
};
