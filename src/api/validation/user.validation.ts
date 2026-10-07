import { z } from "zod";

const userIdParams = z.object({
  userId: z.string().min(1)
});

const userBody = z.object({
  id: z.string().min(1).nullish(),
  name: z.string().nullish(),
  email: z.string().nullish(),
  role: z.string().nullish(),
  avatar: z.string().nullish(),
  lastActive: z.string().nullish(),
  phoneNumber: z.string().nullish(),
  trackingToken: z.string().nullish(),
  locationTrackingEnabled: z.boolean().nullish(),
  pushNotificationsEnabled: z.boolean().nullish(),
  emailNotificationsEnabled: z.boolean().nullish(),
  smsNotificationsEnabled: z.boolean().nullish()
});

export const userValidation = {
  getUsers: z.object({}),
  createUser: z.object({ body: userBody }),
  getUser: z.object({ params: userIdParams }),
  updateUser: z.object({ params: userIdParams, body: userBody.omit({ id: true }) }),
  deleteUser: z.object({ params: userIdParams }),
  regenerateTrackingToken: z.object({ params: userIdParams })
};
