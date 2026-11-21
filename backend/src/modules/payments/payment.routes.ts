import { Router, type Router as ExpressRouter } from "express";

import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validate-request.js";

import {
  createPaymentSchema,
  createRefundSchema,
  listPaymentsQuerySchema,
  paymentIdParamsSchema,
  refundParamsSchema,
} from "./payment.schema.js";

import {
  createPaymentController,
  createRefundController,
  getPaymentController,
  getRefundController,
  listPaymentsController,
} from "./payment.controller.js";

const paymentRouter: ExpressRouter = Router();

// List payments
paymentRouter.get(
  "/",
  validateQuery(listPaymentsQuerySchema),
  listPaymentsController,
);

// Create a pending payment
paymentRouter.post(
  "/",
  validateBody(createPaymentSchema),
  createPaymentController,
);

// Create a refund request for a payment
paymentRouter.post(
  "/:paymentId/refunds",
  validateParams(paymentIdParamsSchema),
  validateBody(createRefundSchema),
  createRefundController,
);

// Retrieve a specific refund
paymentRouter.get(
  "/:paymentId/refunds/:refundId",
  validateParams(refundParamsSchema),
  getRefundController,
);

// Retrieve a specific payment
paymentRouter.get(
  "/:paymentId",
  validateParams(paymentIdParamsSchema),
  getPaymentController,
);

export { paymentRouter };
