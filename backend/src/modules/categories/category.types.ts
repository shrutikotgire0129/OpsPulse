
import type { z } from "zod";

import type {
  categoryIdParamsSchema,
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from "./category.schema.js";

export type CreateCategoryInput = z.infer<
  typeof createCategorySchema
>;

export type UpdateCategoryInput = z.infer<
  typeof updateCategorySchema
>;

export type CategoryIdParams = z.infer<
  typeof categoryIdParamsSchema
>;

export type ListCategoriesQuery = z.infer<
  typeof listCategoriesQuerySchema
>;

/**
 * Organization context must be resolved by trusted
 * server-side authentication and authorization logic.
 *
 * Never populate this directly from an untrusted
 * request body or header.
 */
export interface CategoryContext {
  organizationId: string;
}
