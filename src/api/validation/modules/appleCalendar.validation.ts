import { z } from "zod";

const credentialsIdParams = z.object({
  credentialsId: z.string().min(1)
});

export const appleCalendarValidation = {
  getCredentials: z.object({}),
  setCredentials: z.object({
    params: credentialsIdParams,
    body: z.object({
      username: z.string().trim().min(1),
      password: z.string().nullish(),
      server: z.string().trim().nullish()
    })
  }),
  setPassword: z.object({
    params: credentialsIdParams,
    body: z.object({ password: z.string().min(1) })
  }),
  setServer: z.object({
    params: credentialsIdParams,
    body: z.object({ server: z.string().trim().min(1) })
  }),
  deleteCredentials: z.object({ params: credentialsIdParams }),
  pairCredentials: z.object({ params: credentialsIdParams }),
  getCalendars: z.object({ params: credentialsIdParams })
};
