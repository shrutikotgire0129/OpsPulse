import { Router, type Router as ExpressRouter } from "express";

import { authorize } from "../../middleware/authorization.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validate-request.js";

import {
  categoryIdParamsSchema,
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from "./category.schema.js";

import {
  createCategoryController,
  deleteCategoryController,
  getCategoryController,
  listCategoriesController,
  updateCategoryController,
} from "./category.controller.js";

const categoryRouter: ExpressRouter = Router();

categoryRouter.get(
  "/",
  authorize("categories:read"),
  validateQuery(listCategoriesQuerySchema),
  listCategoriesController,
);

categoryRouter.get(
  "/:categoryId",
  authorize("categories:read"),
  validateParams(categoryIdParamsSchema),
  getCategoryController,
);

categoryRouter.post(
  "/",
  authorize("categories:write"),
  validateBody(createCategorySchema),
  createCategoryController,
);

categoryRouter.patch(
  "/:categoryId",
  authorize("categories:write"),
  validateParams(categoryIdParamsSchema),
  validateBody(updateCategorySchema),
  updateCategoryController,
);

categoryRouter.delete(
  "/:categoryId",
  authorize("categories:write"),
  validateParams(categoryIdParamsSchema),
  deleteCategoryController,
);

export { categoryRouter };
