
import type { z } from "zod";

import type {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
} from "./order.schema.js";

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export type OrderIdParams = z.infer<typeof orderIdParamsSchema>;

/**
 * Organization context must be resolved through
 * trusted server-side authentication and authorization.
 *
 * Never populate this from an untrusted request body,
 * query parameter, or request header.
 */
export interface OrderContext {
  organizationId: string;
}
