import { Router, type Router as ExpressRouter } from "express";

import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validate-request.js";

import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
} from "./order.schema.js";

import {
  createOrderController,
  getOrderController,
  listOrdersController,
} from "./order.controller.js";

const orderRouter: ExpressRouter = Router();

orderRouter.get(
  "/",
  validateQuery(listOrdersQuerySchema),
  listOrdersController,
);

orderRouter.get(
  "/:orderId",
  validateParams(orderIdParamsSchema),
  getOrderController,
);

orderRouter.post(
  "/",
  validateBody(createOrderSchema),
  createOrderController,
);

export { orderRouter };
