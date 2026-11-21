import { z } from "zod";

const paymentIdSchema = z.string().trim().min(1).max(30);
const orderIdSchema = z.string().trim().min(1).max(30);

/**
 * Decimal strings avoid JavaScript floating-point errors.
 * Values must fit Decimal(19,4).
 */
const positiveMoneySchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,15}(\.\d{1,4})?$/,
    "Amount must be a positive decimal with at most 4 decimal places.",
  )
  .refine((value) => /[1-9]/.test(value), {
    message: "Amount must be greater than zero.",
  });

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(
    /^[A-Za-z0-9._:-]+$/,
    "Idempotency key contains unsupported characters.",
  );

/**
 * These methods can be handled through a payment provider.
 *
 * CASH and OTHER are deliberately excluded because this
 * module does not permit unverified manual payment confirmation.
 */
const providerPaymentMethodSchema = z.enum([
  "CARD",
  "BANK_TRANSFER",
  "UPI",
  "NET_BANKING",
  "WALLET",
]);

const providerNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(
    /^[a-z][a-z0-9_-]*$/,
    "Provider name must start with a lowercase letter and contain only lowercase letters, numbers, underscores, or hyphens.",
  );

export const createPaymentSchema = z
  .object({
    orderId: orderIdSchema,
    amount: positiveMoneySchema,
    method: providerPaymentMethodSchema,
    provider: providerNameSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

/**
 * Creates a refund request.
 *
 * Provider, status, provider reference, and organization ID
 * are intentionally excluded from client input.
 */
export const createRefundSchema = z
  .object({
    amount: positiveMoneySchema,
    idempotencyKey: idempotencyKeySchema,
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export const paymentIdParamsSchema = z
  .object({
    paymentId: paymentIdSchema,
  })
  .strict();

export const refundParamsSchema = z
  .object({
    paymentId: paymentIdSchema,
    refundId: paymentIdSchema,
  })
  .strict();

export const listPaymentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    orderId: orderIdSchema.optional(),

    status: z
      .enum([
        "PENDING",
        "PROCESSING",
        "SUCCEEDED",
        "FAILED",
        "CANCELLED",
        "PARTIALLY_REFUNDED",
        "REFUNDED",
      ])
      .optional(),

    method: z
      .enum([
        "CARD",
        "BANK_TRANSFER",
        "UPI",
        "NET_BANKING",
        "CASH",
        "WALLET",
        "OTHER",
      ])
      .optional(),

    provider: providerNameSchema.optional(),

    sortBy: z
      .enum(["amount", "status", "createdAt", "updatedAt", "paidAt"])
      .default("createdAt"),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const cancelPaymentSchema = z
  .object({
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();
