import { Router, type Router as ExpressRouter } from "express";

import { authorize } from "../../middleware/authorization.js";
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
  authorize("orders:read"),
  validateQuery(listOrdersQuerySchema),
  listOrdersController,
);

orderRouter.get(
  "/:orderId",
  authorize("orders:read"),
  validateParams(orderIdParamsSchema),
  getOrderController,
);

orderRouter.post(
  "/",
  authorize("orders:write"),
  validateBody(createOrderSchema),
  createOrderController,
);

export { orderRouter };
