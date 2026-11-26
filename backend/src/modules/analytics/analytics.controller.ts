import type { RequestHandler } from "express";

import { ApiError } from "../../lib/http/api-error.js";
import { sendSuccess } from "../../lib/http/api-response.js";

import { getRevenueAnalytics } from "./analytics.service.js";

import type { AnalyticsContext, DashboardQuery } from "./analytics.types.js";

type ValidatedRequest = {
  query?: unknown;
};

function getAnalyticsContext(
  res: Parameters<RequestHandler>[1],
): AnalyticsContext {
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

function getValidatedQuery(res: Parameters<RequestHandler>[1]): DashboardQuery {
  const validatedRequest = res.locals.validatedRequest as
    | ValidatedRequest
    | undefined;

  const query = validatedRequest?.query;

  if (query === undefined) {
    throw new ApiError(
      500,
      "VALIDATED_REQUEST_MISSING",
      "The validated request data is unavailable.",
    );
  }

  return query as DashboardQuery;
}

export const getDashboardAnalyticsController: RequestHandler = async (
  _req,
  res,
) => {
  const context = getAnalyticsContext(res);
  const query = getValidatedQuery(res);

  const result = await getRevenueAnalytics(context, query);

  return sendSuccess(res, result);
};
