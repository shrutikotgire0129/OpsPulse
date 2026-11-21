import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError } from "../lib/http/api-error.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(
    new ApiError(404, "ROUTE_NOT_FOUND", `Cannot ${req.method} ${req.path}`),
  );
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred.";
  let details: unknown;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Request validation failed.";

    details = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));
  } else if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400
  ) {
    statusCode = 400;
    code = "INVALID_JSON";
    message = "Request body contains invalid JSON.";
  }

  if (statusCode >= 500) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "http_error",
        requestId: res.locals.requestId,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
    meta: {
      requestId: res.locals.requestId,
    },
  });
};
