import type { z } from "zod";

import type {
  createCustomerSchema,
  customerIdParamsSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from "./customer.schema.js";

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export type CustomerIdParams = z.infer<typeof customerIdParamsSchema>;

export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;

/**
 * Organization context must be resolved by trusted
 * server-side authentication and authorization logic.
 *
 * Never populate this directly from an untrusted
 * request body or header.
 */
export interface CustomerContext {
  organizationId: string;
}
