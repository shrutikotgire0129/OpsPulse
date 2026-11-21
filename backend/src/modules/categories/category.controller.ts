
import type { RequestHandler } from "express";

import { ApiError } from "../../lib/http/api-error.js";
import { sendSuccess } from "../../lib/http/api-response.js";

import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "./category.service.js";

import type {
  CategoryContext,
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from "./category.types.js";

type ValidatedRequest = {
  query?: unknown;
  params?: unknown;
};

function getCategoryContext(
  res: Parameters<RequestHandler>[1],
): CategoryContext {
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
  const validatedRequest =
    res.locals.validatedRequest as ValidatedRequest | undefined;

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

export const listCategoriesController: RequestHandler = async (
  _req,
  res,
) => {
  const context = getCategoryContext(res);
  const query = getValidatedValue<ListCategoriesQuery>(
    res,
    "query",
  );

  const result = await listCategories(context, query);

  return sendSuccess(res, result);
};

export const getCategoryController: RequestHandler = async (
  _req,
  res,
) => {
  const context = getCategoryContext(res);
  const { categoryId } = getValidatedValue<{
    categoryId: string;
  }>(res, "params");

  const result = await getCategory(context, categoryId);

  return sendSuccess(res, result);
};

export const createCategoryController: RequestHandler = async (
  req,
  res,
) => {
  const context = getCategoryContext(res);
  const input = req.body as CreateCategoryInput;

  const result = await createCategory(context, input);

  return sendSuccess(res, result, 201);
};

export const updateCategoryController: RequestHandler = async (
  req,
  res,
) => {
  const context = getCategoryContext(res);
  const { categoryId } = getValidatedValue<{
    categoryId: string;
  }>(res, "params");
  const input = req.body as UpdateCategoryInput;

  const result = await updateCategory(
    context,
    categoryId,
    input,
  );

  return sendSuccess(res, result);
};

export const deleteCategoryController: RequestHandler = async (
  _req,
  res,
) => {
  const context = getCategoryContext(res);
  const { categoryId } = getValidatedValue<{
    categoryId: string;
  }>(res, "params");

  const result = await deleteCategory(context, categoryId);

  return sendSuccess(res, result);
};
