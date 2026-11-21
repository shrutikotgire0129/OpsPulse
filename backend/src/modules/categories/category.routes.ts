
import { Router, type Router as ExpressRouter } from "express";

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
  validateQuery(listCategoriesQuerySchema),
  listCategoriesController,
);

categoryRouter.get(
  "/:categoryId",
  validateParams(categoryIdParamsSchema),
  getCategoryController,
);

categoryRouter.post(
  "/",
  validateBody(createCategorySchema),
  createCategoryController,
);

categoryRouter.patch(
  "/:categoryId",
  validateParams(categoryIdParamsSchema),
  validateBody(updateCategorySchema),
  updateCategoryController,
);

categoryRouter.delete(
  "/:categoryId",
  validateParams(categoryIdParamsSchema),
  deleteCategoryController,
);

export { categoryRouter };
