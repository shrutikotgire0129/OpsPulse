import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Express } from "express";
import test from "node:test";

import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
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

test("Production authentication logout integration", async (t) => {
  // Safety guard: never run these tests against the development database.
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.replace(/^\/+/, ""),
  );

  assert.equal(
    databaseName,
    "opspulse_test",
    `Logout integration tests require database "opspulse_test", received "${databaseName}". No test records were created.`,
  );

  const uniqueId = randomUUID().replace(/-/g, "");

  const userIds: string[] = [];
  const tokens = {
    first: generateSessionToken(),
    second: generateSessionToken(),
  };

  try {
    const user = await prisma.user.create({
      data: {
        name: "Logout Integration User",
        email: `logout-integration-${uniqueId}@example.com`,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    userIds.push(user.id);

    await prisma.session.createMany({
      data: [
        {
          userId: user.id,
          tokenHash: hashSessionToken(tokens.first),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        {
          userId: user.id,
          tokenHash: hashSessionToken(tokens.second),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      ],
    });

    const firstSession = await prisma.session.findUniqueOrThrow({
      where: {
        tokenHash: hashSessionToken(tokens.first),
      },
      select: {
        id: true,
        revokedAt: true,
      },
    });

    const secondSession = await prisma.session.findUniqueOrThrow({
      where: {
        tokenHash: hashSessionToken(tokens.second),
      },
      select: {
        id: true,
        revokedAt: true,
      },
    });

    const cookie = (token: string) => `${SESSION_COOKIE_NAME}=${token}`;

    await withServer(app, async (baseUrl) => {
      await t.test(
        "rejects logout requests without authentication",
        async () => {
          const response = await fetch(`${baseUrl}/api/v1/auth/logout`, {
            method: "POST",
          });

          const payload = await response.json();

          assert.equal(response.status, 401);
          assert.equal(payload.success, false);
          assert.equal(payload.error.code, "UNAUTHENTICATED");
        },
      );

      await t.test(
        "revokes only the current session and clears its cookie",
        async () => {
          const response = await fetch(`${baseUrl}/api/v1/auth/logout`, {
            method: "POST",
            headers: {
              Cookie: cookie(tokens.first),
            },
          });

          const payload = await response.json();
          const setCookie = response.headers.get("set-cookie");

          assert.equal(response.status, 200);
          assert.equal(payload.success, true);
          assert.equal(payload.data.loggedOut, true);

          assert.ok(setCookie);
          assert.match(setCookie, new RegExp(`^${SESSION_COOKIE_NAME}=;`));
          assert.match(setCookie, /Expires=/i);
          assert.match(setCookie, /HttpOnly/i);
          assert.match(setCookie, /Path=\//i);

          const isProduction = env.NODE_ENV === "production";

          assert.match(
            setCookie,
            isProduction ? /SameSite=None/i : /SameSite=Lax/i,
          );

          if (isProduction) {
            assert.match(setCookie, /Secure/i);
          }

          const updatedFirstSession = await prisma.session.findUniqueOrThrow({
            where: { id: firstSession.id },
            select: { revokedAt: true },
          });

          const unchangedSecondSession = await prisma.session.findUniqueOrThrow(
            {
              where: { id: secondSession.id },
              select: { revokedAt: true },
            },
          );

          assert.ok(updatedFirstSession.revokedAt);
          assert.equal(unchangedSecondSession.revokedAt, null);
        },
      );

      await t.test(
        "rejects the revoked session on protected production APIs",
        async () => {
          const response = await fetch(`${baseUrl}/api/v1/categories`, {
            headers: {
              Cookie: cookie(tokens.first),
            },
          });

          const payload = await response.json();

          assert.equal(response.status, 401);
          assert.equal(payload.success, false);
          assert.equal(payload.error.code, "UNAUTHENTICATED");
        },
      );

      await t.test(
        "keeps another active session valid after the first logout",
        async () => {
          const response = await fetch(`${baseUrl}/api/v1/auth/logout`, {
            method: "POST",
            headers: {
              Cookie: cookie(tokens.second),
            },
          });

          const payload = await response.json();

          assert.equal(response.status, 200);
          assert.equal(payload.success, true);
          assert.equal(payload.data.loggedOut, true);

          const updatedSecondSession = await prisma.session.findUniqueOrThrow({
            where: { id: secondSession.id },
            select: { revokedAt: true },
          });

          assert.ok(updatedSecondSession.revokedAt);
        },
      );
    });
  } finally {
    // Delete only records created by this test run.
    if (userIds.length > 0) {
      await prisma.session.deleteMany({
        where: {
          userId: { in: userIds },
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: { in: userIds },
        },
      });
    }
  }
});
