import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { env } from "../src/config/env.js";
import { ApiError } from "../src/lib/http/api-error.js";
import { prisma } from "../src/lib/prisma.js";
import { loginUser, registerUser } from "../src/modules/auth/auth.service.js";

import { hashSessionToken } from "../src/modules/auth/session.js";

test("Registration service PostgreSQL integration", async (t) => {
  // Safety guard: never run these tests against the development database.
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.replace(/^\/+/, ""),
  );

  assert.equal(
    databaseName,
    "opspulse_test",
    `Integration tests require database "opspulse_test", received "${databaseName}". No test records were created.`,
  );

  const uniqueId = randomUUID().replace(/-/g, "");
  const userIds: string[] = [];
  const organizationIds: string[] = [];

  const email = `auth-${uniqueId}@example.com`;
  const password = "OpsPulse-Integration-Password-2026!";
  const organizationName = `Integration Company ${uniqueId}`;
  const organizationSlug = `integration-company-${uniqueId}`;

  try {
    await t.test(
      "creates a user, organization and OWNER membership atomically",
      async () => {
        const result = await registerUser({
          name: "Integration User",
          email: `  ${email.toUpperCase()}  `,
          password: "OpsPulse-Integration-Password-2026!",
          organizationName,
        });

        userIds.push(result.user.id);
        organizationIds.push(result.organization.id);

        assert.equal(result.user.name, "Integration User");
        assert.equal(result.user.email, email);
        assert.equal(result.user.status, "ACTIVE");

        assert.equal(result.organization.name, organizationName);
        assert.equal(result.organization.slug, organizationSlug);

        assert.equal(result.membership.role, "OWNER");

        assert.equal(
          Object.hasOwn(result.user, "password"),
          false,
          "Registration response must not expose the password hash.",
        );

        const storedUser = await prisma.user.findUniqueOrThrow({
          where: { id: result.user.id },
          select: { passwordHash: true },
        });

        assert.ok(storedUser.passwordHash);
        assert.ok(storedUser.passwordHash.startsWith("$argon2id$"));

        const storedMembership = await prisma.membership.findUniqueOrThrow({
          where: {
            userId_organizationId: {
              userId: result.user.id,
              organizationId: result.organization.id,
            },
          },
        });

        assert.equal(storedMembership.userId, result.user.id);
        assert.equal(storedMembership.organizationId, result.organization.id);
        assert.equal(storedMembership.role, "OWNER");
      },
    );

    await t.test(
      "logs in an existing user and creates a hashed database session",
      async () => {
        const result = await loginUser({
          email: `  ${email.toUpperCase()}  `,
          password,
        });

        assert.equal(result.user.email, email);
        assert.equal(result.user.name, "Integration User");
        assert.ok(result.sessionToken);
        assert.ok(result.expiresAt instanceof Date);
        assert.ok(result.expiresAt.getTime() > Date.now());

        assert.equal(Object.hasOwn(result.user, "passwordHash"), false);

        assert.equal(result.organizations.length, 1);
        assert.equal(result.organizations[0]?.role, "OWNER");

        const tokenHash = hashSessionToken(result.sessionToken);

        assert.notEqual(tokenHash, result.sessionToken);

        const storedSession = await prisma.session.findUnique({
          where: { tokenHash },
        });

        assert.ok(storedSession);
        assert.equal(storedSession.userId, result.user.id);
        assert.equal(storedSession.tokenHash, tokenHash);
        assert.equal(
          storedSession.expiresAt.getTime(),
          result.expiresAt.getTime(),
        );
        assert.equal(storedSession.revokedAt, null);
      },
    );

    await t.test(
      "rejects an incorrect password with generic credentials error",
      async () => {
        await assert.rejects(
          () =>
            loginUser({
              email,
              password: "OpsPulse-Wrong-Password-2026!",
            }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.statusCode === 401 &&
            error.code === "INVALID_CREDENTIALS" &&
            error.message === "Invalid email or password.",
        );
      },
    );

    await t.test(
      "rejects an unknown email with generic credentials error",
      async () => {
        await assert.rejects(
          () =>
            loginUser({
              email: `unknown-${uniqueId}@example.com`,
              password,
            }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.statusCode === 401 &&
            error.code === "INVALID_CREDENTIALS" &&
            error.message === "Invalid email or password.",
        );
      },
    );

    await t.test("rejects login for an inactive account", async () => {
      const userId = userIds[0];

      assert.ok(userId);

      await prisma.user.update({
        where: { id: userId },
        data: { status: "INACTIVE" },
      });

      try {
        await assert.rejects(
          () => loginUser({ email, password }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.statusCode === 401 &&
            error.code === "INVALID_CREDENTIALS",
        );
      } finally {
        await prisma.user.update({
          where: { id: userId },
          data: { status: "ACTIVE" },
        });
      }
    });

    await t.test("rejects duplicate email addresses", async () => {
      await assert.rejects(
        () =>
          registerUser({
            name: "Duplicate User",
            email,
            password: "OpsPulse-Another-Password-2026!",
            organizationName: `Another Company ${uniqueId}`,
          }),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "EMAIL_ALREADY_EXISTS" &&
          error.statusCode === 409,
      );
    });

    await t.test(
      "generates a different slug when an organization slug already exists",
      async () => {
        const collisionOrganizationName = `Collision ${uniqueId}`;
        const collisionSlug = `collision-${uniqueId}`;

        const existingOrganization = await prisma.organization.create({
          data: {
            name: `Existing ${collisionOrganizationName}`,
            slug: collisionSlug,
          },
        });

        organizationIds.push(existingOrganization.id);

        const result = await registerUser({
          name: "Slug Collision User",
          email: `slug-${uniqueId}@example.com`,
          password: "OpsPulse-Slug-Password-2026!",
          organizationName: collisionOrganizationName,
        });

        userIds.push(result.user.id);
        organizationIds.push(result.organization.id);

        assert.equal(result.organization.slug, `${collisionSlug}-2`);
      },
    );
  } finally {
    // Delete only records created by this test run.
    if (userIds.length > 0) {
      await prisma.session.deleteMany({
        where: { userId: { in: userIds } },
      });
    }

    if (userIds.length > 0 || organizationIds.length > 0) {
      await prisma.membership.deleteMany({
        where: {
          OR: [
            ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
            ...(organizationIds.length > 0
              ? [{ organizationId: { in: organizationIds } }]
              : []),
          ],
        },
      });
    }

    if (organizationIds.length > 0) {
      await prisma.organization.deleteMany({
        where: { id: { in: organizationIds } },
      });
    }

    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    await prisma.$disconnect();
  }
});
