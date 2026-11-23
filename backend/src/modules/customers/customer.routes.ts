import { Router, type Router as ExpressRouter } from "express";

import { authorize } from "../../middleware/authorization.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validate-request.js";

import {
  createCustomerSchema,
  customerIdParamsSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from "./customer.schema.js";

import {
  createCustomerController,
  deleteCustomerController,
  getCustomerController,
  listCustomersController,
  updateCustomerController,
} from "./customer.controller.js";

const customerRouter: ExpressRouter = Router();

customerRouter.get(
  "/",
  authorize("customers:read"),
  validateQuery(listCustomersQuerySchema),
  listCustomersController,
);

customerRouter.get(
  "/:customerId",
  authorize("customers:read"),
  validateParams(customerIdParamsSchema),
  getCustomerController,
);

customerRouter.post(
  "/",
  authorize("customers:write"),
  validateBody(createCustomerSchema),
  createCustomerController,
);

customerRouter.patch(
  "/:customerId",
  authorize("customers:write"),
  validateParams(customerIdParamsSchema),
  validateBody(updateCustomerSchema),
  updateCustomerController,
);

customerRouter.delete(
  "/:customerId",
  authorize("customers:write"),
  validateParams(customerIdParamsSchema),
  deleteCustomerController,
);

export { customerRouter };
