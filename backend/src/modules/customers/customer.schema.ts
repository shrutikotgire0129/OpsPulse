import { z } from "zod";

const customerIdSchema = z.string().trim().min(1).max(30);

const firstNameSchema = z
  .string()
  .trim()
  .min(1, "First name cannot be empty.")
  .max(100, "First name cannot exceed 100 characters.");

const lastNameSchema = z
  .string()
  .trim()
  .min(1, "Last name cannot be empty.")
  .max(100, "Last name cannot exceed 100 characters.");

const optionalCompanySchema = z
  .string()
  .trim()
  .min(1, "Company cannot be empty.")
  .max(160, "Company cannot exceed 160 characters.");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(320, "Email cannot exceed 320 characters.");

const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone cannot be empty.")
  .max(30, "Phone cannot exceed 30 characters.");

const optionalNotesSchema = z
  .string()
  .trim()
  .min(1, "Notes cannot be empty.")
  .max(5000, "Notes cannot exceed 5000 characters.");

const customerStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);

export const createCustomerSchema = z
  .object({
    firstName: firstNameSchema,
    lastName: lastNameSchema,
    company: optionalCompanySchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    notes: optionalNotesSchema.optional(),
    status: customerStatusSchema.optional(),
  })
  .strict();

export const updateCustomerSchema = z
  .object({
    firstName: firstNameSchema.optional(),
    lastName: lastNameSchema.optional(),
    company: optionalCompanySchema.nullable().optional(),
    email: emailSchema.nullable().optional(),
    phone: phoneSchema.nullable().optional(),
    notes: optionalNotesSchema.nullable().optional(),
    status: customerStatusSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for an update.",
  });

export const customerIdParamsSchema = z
  .object({
    customerId: customerIdSchema,
  })
  .strict();

export const listCustomersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(320).optional(),
    status: customerStatusSchema.optional(),
    sortBy: z
      .enum(["firstName", "lastName", "company", "createdAt", "updatedAt"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();
