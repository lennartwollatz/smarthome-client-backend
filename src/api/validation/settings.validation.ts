import { z } from "zod";

const generalSettingsBody = z.object({
  name: z.string().nullish(),
  sprache: z.string().nullish(),
  temperatur: z.string().nullish()
});

const notificationSettingsBody = z.object({
  security: z.boolean().nullish(),
  batterystatus: z.boolean().nullish(),
  energyreport: z.boolean().nullish()
});

const privacySettingsBody = z.object({
  ailearning: z.boolean().nullish()
});

const updateTimesBody = z.object({
  from: z.string().nullish(),
  to: z.string().nullish()
});

/** Speicherbarer Teil der Systemeinstellungen; Versionen und Server-IP werden abgeleitet. */
export const systemSettingsBody = z.object({
  autoupdate: z.boolean().nullish(),
  updatetimes: updateTimesBody.nullish()
});

export const settingsValidation = {
  getSettings: z.object({}),
  updateSettings: z.object({
    body: z.object({
      allgemein: generalSettingsBody.nullish(),
      notifications: notificationSettingsBody.nullish(),
      privacy: privacySettingsBody.nullish(),
      system: systemSettingsBody.nullish()
    })
  }),
  updateNotificationSettings: z.object({ body: notificationSettingsBody }),
  updatePrivacySettings: z.object({ body: privacySettingsBody }),
  deleteAllData: z.object({}),
  factoryReset: z.object({})
};
