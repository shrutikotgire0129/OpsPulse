import { Prisma } from "../../generated/prisma/client.js";

import { ApiError } from "../../lib/http/api-error.js";
import { prisma } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "./password.js";

import type { RegisterInput } from "./auth.schema.js";
import {
  generateSessionToken,
  getSessionExpiry,
  hashSessionToken,
} from "./session.js";

import type { LoginInput } from "./auth.schema.js";

function createSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "organization";
}

async function generateUniqueOrganizationSlug(
  tx: Prisma.TransactionClient,
  organizationName: string,
): Promise<string> {
  const baseSlug = createSlug(organizationName);
  let candidate = baseSlug;
  let suffix = 2;

  while (
    await tx.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function handleRegistrationDatabaseError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = error.meta?.target;
    const targetFields = Array.isArray(target)
      ? target.map(String)
      : typeof target === "string"
        ? [target]
        : [];

    if (targetFields.some((field) => field.includes("email"))) {
      throw new ApiError(
        409,
        "EMAIL_ALREADY_EXISTS",
        "An account with this email address already exists.",
      );
    }

    if (targetFields.some((field) => field.includes("slug"))) {
      throw new ApiError(
        409,
        "ORGANIZATION_SLUG_CONFLICT",
        "The organization name conflicts with an existing organization. Please try again.",
      );
    }

    throw new ApiError(
      409,
      "REGISTRATION_CONFLICT",
      "The account could not be created because of a data conflict.",
    );
  }

  throw error;
}

export async function registerUser(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        throw new ApiError(
          409,
          "EMAIL_ALREADY_EXISTS",
          "An account with this email address already exists.",
        );
      }

      const slug = await generateUniqueOrganizationSlug(
        tx,
        input.organizationName,
      );

      const user = await tx.user.create({
        data: {
          name: input.name,
          email,
          passwordHash,
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          currencyCode: true,
          timezone: true,
          createdAt: true,
        },
      });

      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "OWNER",
        },
        select: {
          id: true,
          role: true,
          createdAt: true,
        },
      });

      return {
        user,
        organization,
        membership,
      };
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    handleRegistrationDatabaseError(error);
  }
}

export async function loginUser(input: LoginInput) {
  const email = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      passwordHash: true,
      memberships: {
        select: {
          id: true,
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              currencyCode: true,
              timezone: true,
            },
          },
        },
      },
    },
  });

  // Use the same error for unknown emails and incorrect passwords.
  if (!user || !user.passwordHash || user.status !== "ACTIVE") {
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password.",
    );
  }

  const passwordIsValid = await verifyPassword(
    input.password,
    user.passwordHash,
  );

  if (!passwordIsValid) {
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password.",
    );
  }

  const sessionToken = generateSessionToken();
  const expiresAt = getSessionExpiry();

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt,
    },
  });

  const organizations = user.memberships
    .filter((membership) => membership.organization.status === "ACTIVE")
    .map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      currencyCode: membership.organization.currencyCode,
      timezone: membership.organization.timezone,
      role: membership.role,
    }));

  return {
    sessionToken,
    expiresAt,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    organizations,
  };
}

export async function getCurrentSession(userId: string, sessionId: string) {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          memberships: {
            where: {
              organization: {
                status: "ACTIVE",
              },
            },
            select: {
              role: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  currencyCode: true,
                  timezone: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session) {
    throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  const organizations = session.user.memberships.map((membership) => ({
    id: membership.organization.id,
    name: membership.organization.name,
    slug: membership.organization.slug,
    currencyCode: membership.organization.currencyCode,
    timezone: membership.organization.timezone,
    role: membership.role,
  }));

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    organizations,
    expiresAt: session.expiresAt,
  };
}

export async function logoutUser(
  userId: string,
  sessionId: string,
): Promise<void> {
  await prisma.session.updateMany({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
