import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestIdMiddleware: RequestHandler = (_req, res, next) => {
  const requestId = randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  next();
};

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = performance.now();

  res.on("finish", () => {
    const requestId = res.locals.requestId as string | undefined;

    const logEntry = {
      level: "info",
      event: "http_request",
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
    };

    console.log(JSON.stringify(logEntry));
  });

  next();
};