import type { RequestHandler } from "express";

import { ApiError } from "../lib/http/api-error.js";
import { prisma } from "../lib/prisma.js";

interface AuthenticatedUserContext {
  id: string;
  name: string;
  email: string;
}

export const resolveOrganizationContext: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const authenticatedUser: unknown = res.locals.authenticatedUser;

    if (
      typeof authenticatedUser !== "object" ||
      authenticatedUser === null ||
      !("id" in authenticatedUser) ||
      typeof authenticatedUser.id !== "string"
    ) {
      throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
    }

    const user = authenticatedUser as AuthenticatedUserContext;

    const organizationId = req.get("X-Organization-Id")?.trim();

    if (!organizationId) {
      throw new ApiError(
        401,
        "ORGANIZATION_CONTEXT_REQUIRED",
        "An authenticated organization context is required.",
      );
    }

    if (organizationId.length > 128) {
      throw new ApiError(
        400,
        "INVALID_ORGANIZATION_CONTEXT",
        "The selected organization ID is invalid.",
      );
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId,
        },
      },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!membership) {
      throw new ApiError(
        403,
        "ORGANIZATION_ACCESS_DENIED",
        "You do not have access to the selected organization.",
      );
    }

    if (membership.organization.status !== "ACTIVE") {
      throw new ApiError(
        403,
        "ORGANIZATION_UNAVAILABLE",
        "The selected organization is not available.",
      );
    }

    res.locals.organizationId = membership.organization.id;
    res.locals.organizationRole = membership.role;

    return next();
  } catch (error) {
    return next(error);
  }
};
