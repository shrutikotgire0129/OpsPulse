import type { z } from "zod";

import type {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamsSchema,
  updateProductSchema,
} from "./product.schema.js";

export type CreateProductInput = z.infer<typeof createProductSchema>;

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export type ProductIdParams = z.infer<typeof productIdParamsSchema>;

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

/**
 * Organization context must be resolved by trusted
 * server-side authentication and authorization logic.
 *
 * Never populate this directly from an untrusted
 * request body or header.
 */
export interface ProductContext {
  organizationId: string;
}
