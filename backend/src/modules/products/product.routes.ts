import { Router, type Router as ExpressRouter } from "express";

import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validate-request.js";

import {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamsSchema,
  updateProductSchema,
} from "./product.schema.js";

import {
  createProductController,
  deleteProductController,
  getProductController,
  listProductsController,
  updateProductController,
} from "./product.controller.js";

const productRouter: ExpressRouter = Router();

productRouter.get(
  "/",
  validateQuery(listProductsQuerySchema),
  listProductsController,
);

productRouter.get(
  "/:productId",
  validateParams(productIdParamsSchema),
  getProductController,
);

productRouter.post(
  "/",
  validateBody(createProductSchema),
  createProductController,
);

productRouter.patch(
  "/:productId",
  validateParams(productIdParamsSchema),
  validateBody(updateProductSchema),
  updateProductController,
);

productRouter.delete(
  "/:productId",
  validateParams(productIdParamsSchema),
  deleteProductController,
);

export { productRouter };
