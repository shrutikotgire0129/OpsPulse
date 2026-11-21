
import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../../lib/http/api-error.js";
import { sendSuccess } from "../../lib/http/api-response.js";
import { prisma } from "../../lib/prisma.js";

export function getHealth(_req: Request, res: Response): void {
  sendSuccess(res, {
    status: "ok",
    service: "opspulse-api",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
}

export async function getReadiness(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    sendSuccess(res, {
      status: "ready",
      service: "opspulse-api",
      checks: {
        database: "connected",
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    next(
      new ApiError(
        503,
        "SERVICE_NOT_READY",
        "The service is temporarily unavailable.",
      ),
    );
  }
}
