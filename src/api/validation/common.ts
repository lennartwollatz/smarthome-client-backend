import { z } from "zod";

/** `true`/`false` oder die Strings `"true"`/`"false"`. */
export const booleanish = z.union([
  z.boolean(),
  z.enum(["true", "false"]).transform(value => value === "true")
]);

/** Zahl oder numerischer String. */
export const numberish = z
  .union([z.number(), z.string().trim().min(1).transform(Number)])
  .pipe(z.number());

export const deviceIdParams = z.object({
  deviceId: z.string().min(1)
});
