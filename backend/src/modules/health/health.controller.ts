import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    data: {
      status: "ok",
      service: "opspulse-api",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
}

export async function getReadiness(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      data: {
        status: "ready",
        service: "opspulse-api",
        checks: {
          database: "connected",
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Database readiness check failed:", error);

    res.status(503).json({
      data: {
        status: "not_ready",
        service: "opspulse-api",
        checks: {
          database: "disconnected",
        },
        timestamp: new Date().toISOString(),
      },
    });
  }
}
