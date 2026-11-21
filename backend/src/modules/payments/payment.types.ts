import type { z } from "zod";

import type {
  cancelPaymentSchema,
  createPaymentSchema,
  createRefundSchema,
  listPaymentsQuerySchema,
  paymentIdParamsSchema,
  refundParamsSchema,
} from "./payment.schema.js";

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

export type RefundParams = z.infer<typeof refundParamsSchema>;

export type PaymentIdParams = z.infer<typeof paymentIdParamsSchema>;

export type CancelPaymentInput = z.infer<typeof cancelPaymentSchema>;

export type CreateRefundInput = z.infer<typeof createRefundSchema>;

/**
 * Organization context must come from trusted server-side
 * authentication and authorization middleware.
 *
 * Never accept organizationId from client input.
 */
export interface PaymentContext {
  organizationId: string;
}
