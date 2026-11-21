import type { Response } from "express";

interface ResponseMeta {
  requestId?: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
): Response {
  const requestId = res.locals.requestId as string | undefined;

  const meta: ResponseMeta = {};

  if (requestId) {
    meta.requestId = requestId;
  }

  return res.status(statusCode).json({
    success: true,
    data,
    meta,
  });
}
