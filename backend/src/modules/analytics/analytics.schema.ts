
import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format.")
  .refine((value) => {
    const parts = value.split("-");

    const year = Number(parts[0] ?? NaN);
    const month = Number(parts[1] ?? NaN);
    const day = Number(parts[2] ?? NaN);

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Date must be a valid calendar date.");

export const dashboardQuerySchema = z
  .object({
    range: z.enum(["7d", "30d", "90d", "12m"]).default("30d"),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  })
  .strict()
  .superRefine((query, context) => {
    const hasStartDate = query.startDate !== undefined;
    const hasEndDate = query.endDate !== undefined;

    if (hasStartDate !== hasEndDate) {
      context.addIssue({
        code: "custom",
        message: "Both startDate and endDate must be provided together.",
        path: [hasStartDate ? "endDate" : "startDate"],
      });
    }

    if (query.startDate && query.endDate && query.startDate > query.endDate) {
      context.addIssue({
        code: "custom",
        message: "startDate must not be after endDate.",
        path: ["startDate"],
      });
    }
  });
