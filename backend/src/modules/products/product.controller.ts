import type { RequestHandler } from "express";

import { ApiError } from "../../lib/http/api-error.js";
import { sendSuccess } from "../../lib/http/api-response.js";

import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "./product.service.js";

import type {
  CreateProductInput,
  ListProductsQuery,
  ProductContext,
  UpdateProductInput,
} from "./product.types.js";

type ValidatedRequest = {
  query?: unknown;
  params?: unknown;
};

function getProductContext(res: Parameters<RequestHandler>[1]): ProductContext {
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

export const listProductsController: RequestHandler = async (_req, res) => {
  const context = getProductContext(res);

  const query = getValidatedValue<ListProductsQuery>(res, "query");

  const result = await listProducts(context, query);

  return sendSuccess(res, result);
};

export const getProductController: RequestHandler = async (_req, res) => {
  const context = getProductContext(res);

  const { productId } = getValidatedValue<{
    productId: string;
  }>(res, "params");

  const result = await getProduct(context, productId);

  return sendSuccess(res, result);
};

export const createProductController: RequestHandler = async (req, res) => {
  const context = getProductContext(res);
  const input = req.body as CreateProductInput;

  const result = await createProduct(context, input);

  return sendSuccess(res, result, 201);
};

export const updateProductController: RequestHandler = async (req, res) => {
  const context = getProductContext(res);

  const { productId } = getValidatedValue<{
    productId: string;
  }>(res, "params");

  const input = req.body as UpdateProductInput;

  const result = await updateProduct(context, productId, input);

  return sendSuccess(res, result);
};

export const deleteProductController: RequestHandler = async (_req, res) => {
  const context = getProductContext(res);

  const { productId } = getValidatedValue<{
    productId: string;
  }>(res, "params");

  const result = await deleteProduct(context, productId);

  return sendSuccess(res, result);
};
