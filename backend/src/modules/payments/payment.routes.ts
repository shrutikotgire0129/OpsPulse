import { Router, type Router as ExpressRouter } from "express";

import { authorize } from "../../middleware/authorization.js";
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

paymentRouter.get(
  "/",
  authorize("payments:read"),
  validateQuery(listPaymentsQuerySchema),
  listPaymentsController,
);

paymentRouter.post(
  "/",
  authorize("payments:manage"),
  validateBody(createPaymentSchema),
  createPaymentController,
);

paymentRouter.post(
  "/:paymentId/refunds",
  authorize("refunds:create"),
  validateParams(paymentIdParamsSchema),
  validateBody(createRefundSchema),
  createRefundController,
);

paymentRouter.get(
  "/:paymentId/refunds/:refundId",
  authorize("refunds:read"),
  validateParams(refundParamsSchema),
  getRefundController,
);

paymentRouter.get(
  "/:paymentId",
  authorize("payments:read"),
  validateParams(paymentIdParamsSchema),
  getPaymentController,
);

export { paymentRouter };
