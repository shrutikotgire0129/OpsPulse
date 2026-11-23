import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Express } from "express";
import express from "express";
import test from "node:test";

import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import {
  errorHandler,
  notFoundHandler,
} from "../src/middleware/error-handler.js";
import { authenticateSession } from "../src/middleware/authenticate.js";
import { resolveOrganizationContext } from "../src/middleware/organization-context.js";
import {
  generateSessionToken,
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "../src/modules/auth/session.js";

async function withServer(
  application: Express,
  callback: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = application.listen(0);

  await once(server, "listening");

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Unable to determine test server address.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

function createOrganizationContextTestApp(): Express {
  const testApp = express();

  testApp.use((_req, res, next) => {
    res.locals.requestId = "organization-context-test";
    next();
  });

  testApp.get(
    "/protected",
    authenticateSession,
    resolveOrganizationContext,
    (_req, res) => {
      res.status(200).json({
        success: true,
        data: {
          organizationId: res.locals.organizationId,
          role: res.locals.organizationRole,
        },
      });
    },
  );

  testApp.use(notFoundHandler);
  testApp.use(errorHandler);

  return testApp;
}

test("Organization context middleware PostgreSQL integration", async (t) => {
  // Safety guard: never run these tests against the development database.
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.replace(/^\/+/, ""),
  );

  assert.equal(
    databaseName,
    "opspulse_test",
    `Organization context tests require database "opspulse_test", received "${databaseName}". No test records were created.`,
  );

  const uniqueId = randomUUID().replace(/-/g, "");

  const userIds: string[] = [];
  const organizationIds: string[] = [];

  const testApp = createOrganizationContextTestApp();

  try {
    const user = await prisma.user.create({
      data: {
        name: "Organization Context Test User",
        email: `organization-context-${uniqueId}@example.com`,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    userIds.push(user.id);

    const activeOrganization = await prisma.organization.create({
      data: {
        name: "Active Test Organization",
        slug: `active-test-${uniqueId}`,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    organizationIds.push(activeOrganization.id);

    const suspendedOrganization = await prisma.organization.create({
      data: {
        name: "Suspended Test Organization",
        slug: `suspended-test-${uniqueId}`,
        status: "SUSPENDED",
      },
      select: {
        id: true,
      },
    });

    organizationIds.push(suspendedOrganization.id);

    const outsiderOrganization = await prisma.organization.create({
      data: {
        name: "Non-member Test Organization",
        slug: `outsider-test-${uniqueId}`,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    organizationIds.push(outsiderOrganization.id);

    await prisma.membership.createMany({
      data: [
        {
          userId: user.id,
          organizationId: activeOrganization.id,
          role: "OWNER",
        },
        {
          userId: user.id,
          organizationId: suspendedOrganization.id,
          role: "MANAGER",
        },
      ],
    });

    const validToken = generateSessionToken();

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(validToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const cookie = `${SESSION_COOKIE_NAME}=${validToken}`;

    await withServer(testApp, async (baseUrl) => {
      await t.test("rejects requests without authentication", async () => {
        const response = await fetch(`${baseUrl}/protected`, {
          headers: {
            "X-Organization-Id": activeOrganization.id,
          },
        });

        const payload = await response.json();

        assert.equal(response.status, 401);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "UNAUTHENTICATED");
      });

      await t.test(
        "rejects authenticated requests without organization selection",
        async () => {
          const response = await fetch(`${baseUrl}/protected`, {
            headers: {
              Cookie: cookie,
            },
          });

          const payload = await response.json();

          assert.equal(response.status, 401);
          assert.equal(payload.success, false);
          assert.equal(
            payload.error.code,
            "ORGANIZATION_CONTEXT_REQUIRED",
          );
        },
      );

      await t.test(
        "accepts an active organization with verified membership",
        async () => {
          const response = await fetch(`${baseUrl}/protected`, {
            headers: {
              Cookie: cookie,
              "X-Organization-Id": activeOrganization.id,
            },
          });

          const payload = await response.json();

          assert.equal(response.status, 200);
          assert.equal(payload.success, true);

          assert.deepEqual(payload.data, {
            organizationId: activeOrganization.id,
            role: "OWNER",
          });
        },
      );

      await t.test(
        "rejects organizations where the user has no membership",
        async () => {
          const response = await fetch(`${baseUrl}/protected`, {
            headers: {
              Cookie: cookie,
              "X-Organization-Id": outsiderOrganization.id,
            },
          });

          const payload = await response.json();

          assert.equal(response.status, 403);
          assert.equal(payload.success, false);
          assert.equal(
            payload.error.code,
            "ORGANIZATION_ACCESS_DENIED",
          );
        },
      );

      await t.test(
        "rejects suspended organizations even when membership exists",
        async () => {
          const response = await fetch(`${baseUrl}/protected`, {
            headers: {
              Cookie: cookie,
              "X-Organization-Id": suspendedOrganization.id,
            },
          });

          const payload = await response.json();

          assert.equal(response.status, 403);
          assert.equal(payload.success, false);
          assert.equal(
            payload.error.code,
            "ORGANIZATION_UNAVAILABLE",
          );
        },
      );

      await t.test(
        "rejects organization IDs longer than 128 characters",
        async () => {
          const response = await fetch(`${baseUrl}/protected`, {
            headers: {
              Cookie: cookie,
              "X-Organization-Id": "x".repeat(129),
            },
          });

          const payload = await response.json();

          assert.equal(response.status, 400);
          assert.equal(payload.success, false);
          assert.equal(
            payload.error.code,
            "INVALID_ORGANIZATION_CONTEXT",
          );
        },
      );
    });
  } finally {
    // Delete only records created by this test run.
    if (userIds.length > 0) {
      await prisma.session.deleteMany({
        where: { userId: { in: userIds } },
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
  }
});
