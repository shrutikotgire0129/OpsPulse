
import type {
  Request,
  RequestHandler,
  Response,
} from "express";
import type { ZodType } from "zod";

type RequestSource = "body" | "query" | "params";

function getRequestValue(
  req: Request,
  source: RequestSource,
): unknown {
  switch (source) {
    case "body":
      return req.body;

    case "query":
      return req.query;

    case "params":
      return req.params;
  }
}

function storeValidatedValue(
  res: Response,
  source: Exclude<RequestSource, "body">,
  value: unknown,
): void {
  const validatedRequest =
    (res.locals.validatedRequest as
      | Partial<Record<Exclude<RequestSource, "body">, unknown>>
      | undefined) ?? {};

  validatedRequest[source] = value;
  res.locals.validatedRequest = validatedRequest;
}

export function validateRequest(
  schema: ZodType,
  source: RequestSource,
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(
      getRequestValue(req, source),
    );

    if (!result.success) {
      return next(result.error);
    }

    if (source === "body") {
      req.body = result.data;
    } else {
      storeValidatedValue(res, source, result.data);
    }

    return next();
  };
}

export function validateBody(schema: ZodType): RequestHandler {
  return validateRequest(schema, "body");
}

export function validateQuery(schema: ZodType): RequestHandler {
  return validateRequest(schema, "query");
}

export function validateParams(schema: ZodType): RequestHandler {
  return validateRequest(schema, "params");
}
