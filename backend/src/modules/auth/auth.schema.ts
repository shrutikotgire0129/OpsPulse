import { z } from "zod";

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters.")
      .max(100, "Name cannot exceed 100 characters."),

    email: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .max(320, "Email cannot exceed 320 characters.")
      .transform((value) => value.toLowerCase()),

    password: z
      .string()
      .min(12, "Password must contain at least 12 characters.")
      .max(128, "Password cannot exceed 128 characters."),

    organizationName: z
      .string()
      .trim()
      .min(2, "Organization name must contain at least 2 characters.")
      .max(120, "Organization name cannot exceed 120 characters."),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .max(320, "Email cannot exceed 320 characters.")
      .transform((value) => value.toLowerCase()),

    password: z
      .string()
      .min(1, "Password is required.")
      .max(128, "Password cannot exceed 128 characters."),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
