import type { RequestHandler } from "express";

import { ApiError } from "../../lib/http/api-error.js";
import { sendSuccess } from "../../lib/http/api-response.js";

import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "./customer.service.js";

import type {
  CreateCustomerInput,
  CustomerContext,
  ListCustomersQuery,
  UpdateCustomerInput,
} from "./customer.types.js";

type ValidatedRequest = {
  query?: unknown;
  params?: unknown;
};

function getCustomerContext(
  res: Parameters<RequestHandler>[1],
): CustomerContext {
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

export const listCustomersController: RequestHandler = async (_req, res) => {
  const context = getCustomerContext(res);
  const query = getValidatedValue<ListCustomersQuery>(res, "query");

  const result = await listCustomers(context, query);

  return sendSuccess(res, result);
};

export const getCustomerController: RequestHandler = async (_req, res) => {
  const context = getCustomerContext(res);

  const { customerId } = getValidatedValue<{
    customerId: string;
  }>(res, "params");

  const result = await getCustomer(context, customerId);

  return sendSuccess(res, result);
};

export const createCustomerController: RequestHandler = async (req, res) => {
  const context = getCustomerContext(res);
  const input = req.body as CreateCustomerInput;

  const result = await createCustomer(context, input);

  return sendSuccess(res, result, 201);
};

export const updateCustomerController: RequestHandler = async (req, res) => {
  const context = getCustomerContext(res);

  const { customerId } = getValidatedValue<{
    customerId: string;
  }>(res, "params");

  const input = req.body as UpdateCustomerInput;

  const result = await updateCustomer(context, customerId, input);

  return sendSuccess(res, result);
};

export const deleteCustomerController: RequestHandler = async (_req, res) => {
  const context = getCustomerContext(res);

  const { customerId } = getValidatedValue<{
    customerId: string;
  }>(res, "params");

  const result = await deleteCustomer(context, customerId);

  return sendSuccess(res, result);
};
