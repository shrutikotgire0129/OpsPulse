import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Express } from "express";
import test from "node:test";

import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";

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

test("Authentication registration HTTP API", async (t) => {
  // Safety guard: never run these tests against the development database.
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.replace(/^\/+/, ""),
  );

  assert.equal(
    databaseName,
    "opspulse_test",
    `API integration tests require database "opspulse_test", received "${databaseName}". No test records were created.`,
  );

  const uniqueId = randomUUID().replace(/-/g, "");
  const email = `auth-api-${uniqueId}@example.com`;
  const password = "OpsPulse-API-Integration-2026!";
  const organizationName = `API Test Company ${uniqueId}`;

  const userIds: string[] = [];
  const organizationIds: string[] = [];
  let sessionCookie: string | null = null;

  try {
    await withServer(app, async (baseUrl) => {
      await t.test(
        "rejects invalid registration input with HTTP 400",
        async () => {
          const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "A",
              email: "not-an-email",
              password: "short",
              organizationName: "X",
            }),
          });

          const payload = await response.json();

          assert.equal(response.status, 400);
          assert.equal(payload.success, false);
          assert.equal(payload.error.code, "VALIDATION_ERROR");
          assert.ok(payload.error.details.length > 0);
          assert.ok(payload.meta.requestId);
        },
      );

      await t.test("registers a user through the HTTP API", async () => {
        const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "API Integration User",
            email: `  ${email.toUpperCase()}  `,
            password: "OpsPulse-API-Integration-2026!",
            organizationName,
          }),
        });

        const payload = await response.json();

        if (payload.success === true) {
          userIds.push(payload.data.user.id);
          organizationIds.push(payload.data.organization.id);
        }

        assert.equal(response.status, 201);
        assert.equal(payload.success, true);

        assert.equal(payload.data.user.name, "API Integration User");
        assert.equal(payload.data.user.email, email);
        assert.equal(payload.data.user.status, "ACTIVE");

        assert.equal(payload.data.organization.name, organizationName);
        assert.equal(payload.data.membership.role, "OWNER");

        assert.equal(
          Object.hasOwn(payload.data.user, "password"),
          false,
          "The HTTP response must never expose the password hash.",
        );

        assert.ok(payload.meta.requestId);
      });

      await t.test(
        "rejects unauthenticated session requests with HTTP 401",
        async () => {
          const response = await fetch(`${baseUrl}/api/v1/auth/session`);

          const payload = await response.json();

          assert.equal(response.status, 401);
          assert.equal(payload.success, false);
          assert.ok(payload.error.code);
        },
      );

      await t.test(
        "logs in through the HTTP API and sets a secure session cookie",
        async () => {
          const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: `  ${email.toUpperCase()}  `,
              password,
            }),
          });

          const payload = await response.json();
          const setCookie = response.headers.get("set-cookie");
          assert.ok(setCookie);
          sessionCookie = setCookie.split(";")[0] ?? null;
          assert.ok(sessionCookie);

          assert.equal(response.status, 200);
          assert.equal(payload.success, true);

          assert.equal(payload.data.user.email, email);
          assert.equal(payload.data.user.name, "API Integration User");

          assert.equal(payload.data.organizations.length, 1);
          assert.equal(payload.data.organizations[0].role, "OWNER");

          assert.ok(payload.data.expiresAt);

          assert.equal(Object.hasOwn(payload.data, "sessionToken"), false);

          assert.equal(JSON.stringify(payload).includes("passwordHash"), false);

          assert.ok(setCookie);
          assert.ok(setCookie.startsWith("opspulse_session="));
          assert.match(setCookie, /HttpOnly/i);
          assert.match(setCookie, /Path=\//i);
          assert.match(setCookie, /Expires=/i);

          const isProduction = env.NODE_ENV === "production";

          assert.match(
            setCookie,
            isProduction ? /SameSite=None/i : /SameSite=Lax/i,
          );

          if (isProduction) {
            assert.match(setCookie, /Secure/i);
          }

          const storedSessions = await prisma.session.findMany({
            where: {
              userId: payload.data.user.id,
            },
          });

          assert.ok(storedSessions.length > 0);

          const latestSession = storedSessions.sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          )[0];

          assert.ok(latestSession);
          assert.equal(latestSession.revokedAt, null);
        },
      );

      await t.test(
        "rejects incorrect login credentials with HTTP 401",
        async () => {
          const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password: "OpsPulse-Wrong-Password-2026!",
            }),
          });

          const payload = await response.json();

          assert.equal(response.status, 401);
          assert.equal(payload.success, false);
          assert.equal(payload.error.code, "INVALID_CREDENTIALS");
          assert.equal(payload.error.message, "Invalid email or password.");
        },
      );

      await t.test("rejects unknown login accounts with HTTP 401", async () => {
        const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: `unknown-${uniqueId}@example.com`,
            password,
          }),
        });

        const payload = await response.json();

        assert.equal(response.status, 401);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "INVALID_CREDENTIALS");
        assert.equal(payload.error.message, "Invalid email or password.");
      });

      await t.test("rejects invalid login input with HTTP 400", async () => {
        const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "invalid-email",
            password: "",
          }),
        });

        const payload = await response.json();

        assert.equal(response.status, 400);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "VALIDATION_ERROR");
      });

      await t.test("rejects duplicate email with HTTP 409", async () => {
        const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Duplicate API User",
            email,
            password: "OpsPulse-Duplicate-Password-2026!",
            organizationName: `Duplicate Company ${uniqueId}`,
          }),
        });

        const payload = await response.json();

        assert.equal(response.status, 409);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "EMAIL_ALREADY_EXISTS");
        assert.ok(payload.meta.requestId);
      });
      await t.test(
        "returns the authenticated user and organizations from the session cookie",
        async () => {
          assert.ok(sessionCookie, "Login must provide a session cookie.");

          const response = await fetch(`${baseUrl}/api/v1/auth/session`, {
            headers: {
              Cookie: sessionCookie,
            },
          });

          const payload = await response.json();

          assert.equal(response.status, 200);
          assert.equal(payload.success, true);

          assert.equal(payload.data.user.email, email);
          assert.equal(payload.data.user.name, "API Integration User");

          assert.equal(payload.data.organizations.length, 1);
          assert.equal(payload.data.organizations[0].name, organizationName);
          assert.equal(payload.data.organizations[0].role, "OWNER");

          assert.ok(payload.data.expiresAt);

          assert.equal(
            Object.hasOwn(payload.data, "sessionToken"),
            false,
            "The session token must never be exposed in the response.",
          );

          assert.equal(JSON.stringify(payload).includes("passwordHash"), false);
        },
      );
    });
  } finally {
    // Delete only records created by this test run.
    if (userIds.length > 0) {
      await prisma.session.deleteMany({
        where: { userId: { in: userIds } },
      });

      await prisma.membership.deleteMany({
        where: { userId: { in: userIds } },
      });
    }

    if (organizationIds.length > 0) {
      await prisma.membership.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });

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
