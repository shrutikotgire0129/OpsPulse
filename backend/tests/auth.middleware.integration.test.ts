import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Express } from "express";
import express from "express";
import test from "node:test";

import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { authenticateSession } from "../src/middleware/authenticate.js";
import {
  errorHandler,
  notFoundHandler,
} from "../src/middleware/error-handler.js";
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

function createAuthenticationTestApp(): Express {
  const testApp = express();

  testApp.use(express.json());

  testApp.use((_req, res, next) => {
    res.locals.requestId = "auth-middleware-test";
    next();
  });

  testApp.get("/protected", authenticateSession, (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        user: res.locals.authenticatedUser,
      },
    });
  });

  testApp.use(notFoundHandler);
  testApp.use(errorHandler);

  return testApp;
}

test("Session authentication middleware PostgreSQL integration", async (t) => {
  // Safety guard: never run these tests against the development database.
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.replace(/^\/+/, ""),
  );

  assert.equal(
    databaseName,
    "opspulse_test",
    `Authentication middleware tests require database "opspulse_test", received "${databaseName}". No test records were created.`,
  );

  const uniqueId = randomUUID().replace(/-/g, "");

  const userIds: string[] = [];

  const testApp = createAuthenticationTestApp();

  try {
    const activeUser = await prisma.user.create({
      data: {
        name: "Authentication Test User",
        email: `auth-middleware-${uniqueId}@example.com`,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    userIds.push(activeUser.id);

    const inactiveUser = await prisma.user.create({
      data: {
        name: "Inactive Authentication Test User",
        email: `auth-middleware-inactive-${uniqueId}@example.com`,
        status: "INACTIVE",
      },
      select: {
        id: true,
      },
    });

    userIds.push(inactiveUser.id);

    const validToken = generateSessionToken();
    const expiredToken = generateSessionToken();
    const revokedToken = generateSessionToken();
    const inactiveUserToken = generateSessionToken();

    await prisma.session.createMany({
      data: [
        {
          userId: activeUser.id,
          tokenHash: hashSessionToken(validToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        {
          userId: activeUser.id,
          tokenHash: hashSessionToken(expiredToken),
          expiresAt: new Date(Date.now() - 60 * 60 * 1000),
        },
        {
          userId: activeUser.id,
          tokenHash: hashSessionToken(revokedToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          revokedAt: new Date(),
        },
        {
          userId: inactiveUser.id,
          tokenHash: hashSessionToken(inactiveUserToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      ],
    });

    await withServer(testApp, async (baseUrl) => {
      await t.test("rejects requests without a session cookie", async () => {
        const response = await fetch(`${baseUrl}/protected`);
        const payload = await response.json();

        assert.equal(response.status, 401);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "UNAUTHENTICATED");
        assert.equal(payload.error.message, "Authentication is required.");
      });

      await t.test("rejects malformed session tokens", async () => {
        const response = await fetch(`${baseUrl}/protected`, {
          headers: {
            Cookie: `${SESSION_COOKIE_NAME}=invalid-token`,
          },
        });

        const payload = await response.json();

        assert.equal(response.status, 401);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "UNAUTHENTICATED");
      });

      await t.test("rejects unknown session tokens", async () => {
        const unknownToken = generateSessionToken();

        const response = await fetch(`${baseUrl}/protected`, {
          headers: {
            Cookie: `${SESSION_COOKIE_NAME}=${unknownToken}`,
          },
        });

        const payload = await response.json();

        assert.equal(response.status, 401);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "UNAUTHENTICATED");
      });

      await t.test(
        "accepts a valid session and attaches safe user data",
        async () => {
          const response = await fetch(`${baseUrl}/protected`, {
            headers: {
              Cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
            },
          });

          const payload = await response.json();

          assert.equal(response.status, 200);
          assert.equal(payload.success, true);

          const validSession = await prisma.session.findUnique({
            where: {
              tokenHash: hashSessionToken(validToken),
            },
            select: {
              id: true,
            },
          });

          assert.ok(validSession, "Expected the valid session to exist");

          assert.deepEqual(payload.data.user, {
            id: activeUser.id,
            name: activeUser.name,
            email: activeUser.email,
            sessionId: validSession.id,
          });

          assert.equal(Object.hasOwn(payload.data.user, "passwordHash"), false);
        },
      );

      await t.test("rejects expired sessions", async () => {
        const response = await fetch(`${baseUrl}/protected`, {
          headers: {
            Cookie: `${SESSION_COOKIE_NAME}=${expiredToken}`,
          },
        });

        const payload = await response.json();

        assert.equal(response.status, 401);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "UNAUTHENTICATED");
      });

      await t.test("rejects revoked sessions", async () => {
        const response = await fetch(`${baseUrl}/protected`, {
          headers: {
            Cookie: `${SESSION_COOKIE_NAME}=${revokedToken}`,
          },
        });

        const payload = await response.json();

        assert.equal(response.status, 401);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "UNAUTHENTICATED");
      });

      await t.test("rejects sessions belonging to inactive users", async () => {
        const response = await fetch(`${baseUrl}/protected`, {
          headers: {
            Cookie: `${SESSION_COOKIE_NAME}=${inactiveUserToken}`,
          },
        });

        const payload = await response.json();

        assert.equal(response.status, 401);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "UNAUTHENTICATED");
      });

      await t.test("rejects duplicate session cookies", async () => {
        const response = await fetch(`${baseUrl}/protected`, {
          headers: {
            Cookie:
              `${SESSION_COOKIE_NAME}=${validToken}; ` +
              `${SESSION_COOKIE_NAME}=${validToken}`,
          },
        });

        const payload = await response.json();

        assert.equal(response.status, 401);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "UNAUTHENTICATED");
      });
    });
  } finally {
    // Delete only records created by this test run.
    if (userIds.length > 0) {
      await prisma.session.deleteMany({
        where: { userId: { in: userIds } },
      });

      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    await prisma.$disconnect();
  }
});
