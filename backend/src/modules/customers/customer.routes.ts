import { Router, type Router as ExpressRouter } from "express";

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
  validateQuery(listCustomersQuerySchema),
  listCustomersController,
);

customerRouter.get(
  "/:customerId",
  validateParams(customerIdParamsSchema),
  getCustomerController,
);

customerRouter.post(
  "/",
  validateBody(createCustomerSchema),
  createCustomerController,
);

customerRouter.patch(
  "/:customerId",
  validateParams(customerIdParamsSchema),
  validateBody(updateCustomerSchema),
  updateCustomerController,
);

customerRouter.delete(
  "/:customerId",
  validateParams(customerIdParamsSchema),
  deleteCustomerController,
);

export { customerRouter };
