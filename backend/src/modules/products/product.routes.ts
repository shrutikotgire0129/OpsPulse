import { Router, type Router as ExpressRouter } from "express";

import { authorize } from "../../middleware/authorization.js";
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
  authorize("products:read"),
  validateQuery(listProductsQuerySchema),
  listProductsController,
);

productRouter.get(
  "/:productId",
  authorize("products:read"),
  validateParams(productIdParamsSchema),
  getProductController,
);

productRouter.post(
  "/",
  authorize("products:write"),
  validateBody(createProductSchema),
  createProductController,
);

productRouter.patch(
  "/:productId",
  authorize("products:write"),
  validateParams(productIdParamsSchema),
  validateBody(updateProductSchema),
  updateProductController,
);

productRouter.delete(
  "/:productId",
  authorize("products:write"),
  validateParams(productIdParamsSchema),
  deleteProductController,
);

export { productRouter };
