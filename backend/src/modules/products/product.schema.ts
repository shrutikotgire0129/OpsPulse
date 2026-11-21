import { z } from "zod";

const productIdSchema = z.string().trim().min(1).max(30);

const productNameSchema = z
  .string()
  .trim()
  .min(2, "Product name must contain at least 2 characters.")
  .max(160, "Product name cannot exceed 160 characters.");

const optionalDescriptionSchema = z
  .string()
  .trim()
  .min(1, "Description cannot be empty.")
  .max(5000, "Description cannot exceed 5000 characters.");

const nullableDescriptionSchema = optionalDescriptionSchema.nullable();

const optionalSkuSchema = z
  .string()
  .trim()
  .min(1, "SKU cannot be empty.")
  .max(100, "SKU cannot exceed 100 characters.");

const optionalBarcodeSchema = z
  .string()
  .trim()
  .min(1, "Barcode cannot be empty.")
  .max(100, "Barcode cannot exceed 100 characters.");

const moneySchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,15}(\.\d{1,4})?$/,
    "Amount must be a non-negative decimal with at most 4 decimal places.",
  );

const currencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, "Currency code must be 3 uppercase letters.");

const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export const createProductSchema = z
  .object({
    name: productNameSchema,

    description: optionalDescriptionSchema.optional(),

    sku: optionalSkuSchema.optional(),

    barcode: optionalBarcodeSchema.optional(),

    price: moneySchema,

    cost: moneySchema.optional(),

    currencyCode: currencyCodeSchema.optional(),

    status: productStatusSchema.optional(),

    categoryId: productIdSchema.optional(),
  })
  .strict();

export const updateProductSchema = z
  .object({
    name: productNameSchema.optional(),

    description: nullableDescriptionSchema.optional(),

    sku: optionalSkuSchema.nullable().optional(),

    barcode: optionalBarcodeSchema.nullable().optional(),

    price: moneySchema.optional(),

    cost: moneySchema.nullable().optional(),

    currencyCode: currencyCodeSchema.optional(),

    status: productStatusSchema.optional(),

    categoryId: productIdSchema.nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for an update.",
  });

export const productIdParamsSchema = z
  .object({
    productId: productIdSchema,
  })
  .strict();

export const listProductsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    search: z.string().trim().min(1).max(160).optional(),

    categoryId: productIdSchema.optional(),

    status: productStatusSchema.optional(),

    sortBy: z
      .enum(["name", "price", "createdAt", "updatedAt"])
      .default("createdAt"),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();
