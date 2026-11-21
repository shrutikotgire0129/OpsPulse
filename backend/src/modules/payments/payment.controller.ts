import type { RequestHandler } from "express";

import { ApiError } from "../../lib/http/api-error.js";
import { sendSuccess } from "../../lib/http/api-response.js";

import {
  createPayment,
  createRefund,
  getPayment,
  getRefund,
  listPayments,
} from "./payment.service.js";

import type {
  CreatePaymentInput,
  CreateRefundInput,
  ListPaymentsQuery,
  PaymentContext,
  PaymentIdParams,
  RefundParams,
} from "./payment.types.js";

type ValidatedRequest = {
  query?: unknown;
  params?: unknown;
};

function getPaymentContext(res: Parameters<RequestHandler>[1]): PaymentContext {
  const organizationId: unknown = res.locals.organizationId;

  if (
    typeof organizationId !== "string" ||
    organizationId.trim().length === 0
  ) {
    throw new ApiError(
      401,
      "ORGANIZATION_CONTEXT_REQUIRED",
      "An authenticated organization context is required.",
    );
  }

  return { organizationId };
}

function getValidatedValue<T>(
  res: Parameters<RequestHandler>[1],
  key: "query" | "params",
): T {
  const validatedRequest = res.locals.validatedRequest as
    | ValidatedRequest
    | undefined;

  const value = validatedRequest?.[key];

  if (value === undefined) {
    throw new ApiError(
      500,
      "VALIDATED_REQUEST_MISSING",
      "The validated request data is unavailable.",
    );
  }

  return value as T;
}

export const listPaymentsController: RequestHandler = async (_req, res) => {
  const context = getPaymentContext(res);
  const query = getValidatedValue<ListPaymentsQuery>(res, "query");

  const result = await listPayments(context, query);

  return sendSuccess(res, result);
};

export const getPaymentController: RequestHandler = async (_req, res) => {
  const context = getPaymentContext(res);
  const { paymentId } = getValidatedValue<PaymentIdParams>(res, "params");

  const result = await getPayment(context, paymentId);

  return sendSuccess(res, result);
};

export const createPaymentController: RequestHandler = async (req, res) => {
  const context = getPaymentContext(res);
  const input = req.body as CreatePaymentInput;

  const result = await createPayment(context, input);

  return sendSuccess(res, result, 201);
};

export const createRefundController: RequestHandler = async (req, res) => {
  const context = getPaymentContext(res);
  const { paymentId } = getValidatedValue<PaymentIdParams>(res, "params");
  const input = req.body as CreateRefundInput;

  const result = await createRefund(context, paymentId, input);

  return sendSuccess(res, result, 201);
};

export const getRefundController: RequestHandler = async (_req, res) => {
  const context = getPaymentContext(res);
  const { paymentId, refundId } = getValidatedValue<RefundParams>(
    res,
    "params",
  );

  const result = await getRefund(context, paymentId, refundId);

  return sendSuccess(res, result);
};
