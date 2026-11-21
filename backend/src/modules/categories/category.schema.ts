
import { z } from "zod";

const categoryIdSchema = z.string().trim().min(1).max(30);

export const createCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Category name must contain at least 2 characters.")
      .max(120, "Category name cannot exceed 120 characters."),

    description: z
      .string()
      .trim()
      .min(1, "Description cannot be empty.")
      .max(1000, "Description cannot exceed 1000 characters.")
      .optional(),

    parentId: categoryIdSchema.optional(),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Category name must contain at least 2 characters.")
      .max(120, "Category name cannot exceed 120 characters.")
      .optional(),

    description: z
      .string()
      .trim()
      .min(1, "Description cannot be empty.")
      .max(1000, "Description cannot exceed 1000 characters.")
      .nullable()
      .optional(),

    parentId: categoryIdSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided for an update.",
    },
  );

export const categoryIdParamsSchema = z
  .object({
    categoryId: categoryIdSchema,
  })
  .strict();

export const listCategoriesQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .default(1),

    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20),

    search: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional(),

    parentId: categoryIdSchema.optional(),
  })
  .strict();
