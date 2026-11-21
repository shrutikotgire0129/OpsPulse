import type { RequestHandler } from "express";

import { ApiError } from "../../lib/http/api-error.js";
import { sendSuccess } from "../../lib/http/api-response.js";

import {
  createOrder,
  getOrder,
  listOrders,
} from "./order.service.js";

import type {
  CreateOrderInput,
  ListOrdersQuery,
  OrderContext,
} from "./order.types.js";

type ValidatedRequest = {
  query?: unknown;
  params?: unknown;
};

function getOrderContext(
  res: Parameters<RequestHandler>[1],
): OrderContext {
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

export const listOrdersController: RequestHandler = async (_req, res) => {
  const context = getOrderContext(res);
  const query = getValidatedValue<ListOrdersQuery>(res, "query");

  const result = await listOrders(context, query);

  return sendSuccess(res, result);
};

export const getOrderController: RequestHandler = async (_req, res) => {
  const context = getOrderContext(res);

  const { orderId } = getValidatedValue<{
    orderId: string;
  }>(res, "params");

  const result = await getOrder(context, orderId);

  return sendSuccess(res, result);
};

export const createOrderController: RequestHandler = async (req, res) => {
  const context = getOrderContext(res);
  const input = req.body as CreateOrderInput;

  const result = await createOrder(context, input);

  return sendSuccess(res, result, 201);
};
