import { z } from "zod";

const orderIdSchema = z.string().trim().min(1).max(30);

const productIdSchema = z.string().trim().min(1).max(30);

const customerIdSchema = z.string().trim().min(1).max(30);

/**
 * Decimal strings are used instead of JavaScript numbers
 * to avoid floating-point precision errors.
 *
 * Decimal(19, 4) supports up to 15 integer digits
 * and 4 fractional digits.
 */
const moneySchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,15}(\.\d{1,4})?$/,
    "Amount must be a non-negative decimal with at most 4 decimal places.",
  );

const positiveDecimalSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,15}(\.\d{1,4})?$/,
    "Value must be a positive decimal with at most 4 decimal places.",
  )
  .refine((value) => /[1-9]/.test(value), {
    message: "Value must be greater than zero.",
  });

const orderAddressSchema = z
  .object({
    recipientName: z.string().trim().min(1).max(160).optional(),
    phone: z.string().trim().min(1).max(30).optional(),
    line1: z.string().trim().min(1).max(255),
    line2: z.string().trim().min(1).max(255).optional(),
    city: z.string().trim().min(1).max(120),
    region: z.string().trim().min(1).max(120).optional(),
    postalCode: z.string().trim().min(1).max(30),
    countryCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, "Country code must contain 2 uppercase letters."),
  })
  .strict();

const orderItemInputSchema = z
  .object({
    productId: productIdSchema,

    quantity: positiveDecimalSchema,

    discountAmount: moneySchema.default("0.0000"),

    taxAmount: moneySchema.default("0.0000"),
  })
  .strict();

const orderItemsSchema = z
  .array(orderItemInputSchema)
  .min(1, "An order must contain at least one item.")
  .max(100, "An order cannot contain more than 100 items.")
  .refine(
    (items) =>
      new Set(items.map((item) => item.productId)).size === items.length,
    {
      message: "Each product can appear only once in an order.",
    },
  );

export const createOrderSchema = z
  .object({
    customerId: customerIdSchema.optional(),

    items: orderItemsSchema,

    // Explicit shipping charge.
    shippingTotal: moneySchema.default("0.0000"),

    billingAddress: orderAddressSchema.optional(),

    shippingAddress: orderAddressSchema.optional(),

    channel: z.string().trim().min(1).max(100).optional(),

    notes: z.string().trim().min(1).max(5000).optional(),
  })
  .strict();

export const orderIdParamsSchema = z
  .object({
    orderId: orderIdSchema,
  })
  .strict();

export const listOrdersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    search: z.string().trim().min(1).max(100).optional(),

    customerId: customerIdSchema.optional(),

    status: z
      .enum([
        "DRAFT",
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
      ])
      .optional(),

    sortBy: z
      .enum([
        "orderNumber",
        "status",
        "grandTotal",
        "createdAt",
        "updatedAt",
        "placedAt",
      ])
      .default("createdAt"),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();
