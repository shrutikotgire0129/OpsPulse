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

test("Production API authentication and authorization integration", async (t) => {
  // Safety guard: never run these tests against the development database.
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.replace(/^\/+/, ""),
  );

  assert.equal(
    databaseName,
    "opspulse_test",
    `Authorization API tests require database "opspulse_test", received "${databaseName}". No test records were created.`,
  );

  const uniqueId = randomUUID().replace(/-/g, "");

  const userIds: string[] = [];
  const organizationIds: string[] = [];
  const categoryIds: string[] = [];

  const tokens = {
    owner: generateSessionToken(),
    member: generateSessionToken(),
    analyst: generateSessionToken(),
    outsider: generateSessionToken(),
  };

  try {
    // Create four test users.
    const [owner, member, analyst, outsider] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Authorization Owner",
          email: `authorization-owner-${uniqueId}@example.com`,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          name: "Authorization Member",
          email: `authorization-member-${uniqueId}@example.com`,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          name: "Authorization Analyst",
          email: `authorization-analyst-${uniqueId}@example.com`,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          name: "Authorization Outsider",
          email: `authorization-outsider-${uniqueId}@example.com`,
        },
        select: { id: true },
      }),
    ]);

    userIds.push(owner.id, member.id, analyst.id, outsider.id);

    // Create the organization shared by OWNER, MEMBER and ANALYST.
    const organization = await prisma.organization.create({
      data: {
        name: "Authorization Test Organization",
        slug: `authorization-test-${uniqueId}`,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    organizationIds.push(organization.id);

    // Create another organization for the outsider.
    const outsiderOrganization = await prisma.organization.create({
      data: {
        name: "Authorization Outsider Organization",
        slug: `authorization-outsider-${uniqueId}`,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    organizationIds.push(outsiderOrganization.id);

    // Assign actual database-backed membership roles.
    await prisma.membership.createMany({
      data: [
        {
          userId: owner.id,
          organizationId: organization.id,
          role: "OWNER",
        },
        {
          userId: member.id,
          organizationId: organization.id,
          role: "MEMBER",
        },
        {
          userId: analyst.id,
          organizationId: organization.id,
          role: "ANALYST",
        },
        {
          userId: outsider.id,
          organizationId: outsiderOrganization.id,
          role: "OWNER",
        },
      ],
    });

    // Store only token hashes in the database.
    await prisma.session.createMany({
      data: [
        {
          userId: owner.id,
          tokenHash: hashSessionToken(tokens.owner),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        {
          userId: member.id,
          tokenHash: hashSessionToken(tokens.member),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        {
          userId: analyst.id,
          tokenHash: hashSessionToken(tokens.analyst),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        {
          userId: outsider.id,
          tokenHash: hashSessionToken(tokens.outsider),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      ],
    });

    // Seed one category belonging to the shared organization.
    const existingCategory = await prisma.category.create({
      data: {
        organizationId: organization.id,
        name: "Existing Test Category",
        slug: `existing-test-${uniqueId}`,
        description: "Category used by authorization integration tests.",
      },
      select: { id: true },
    });

    categoryIds.push(existingCategory.id);

    const organizationHeader = {
      "X-Organization-Id": organization.id,
    };

    const cookie = (token: string) => `${SESSION_COOKIE_NAME}=${token}`;

    await withServer(app, async (baseUrl) => {
      await t.test(
        "rejects authenticated requests without organization selection",
        async () => {
          const response = await fetch(`${baseUrl}/api/v1/categories`, {
            headers: {
              Cookie: cookie(tokens.owner),
            },
          });

          const payload = await response.json();

          assert.equal(response.status, 401);
          assert.equal(payload.success, false);
          assert.equal(payload.error.code, "ORGANIZATION_CONTEXT_REQUIRED");
        },
      );

      await t.test("OWNER can read categories", async () => {
        const response = await fetch(`${baseUrl}/api/v1/categories`, {
          headers: {
            Cookie: cookie(tokens.owner),
            ...organizationHeader,
          },
        });

        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.success, true);

        assert.ok(
          payload.data.items.some(
            (category: { id: string }) => category.id === existingCategory.id,
          ),
        );
      });

      await t.test("OWNER can create categories", async () => {
        const response = await fetch(`${baseUrl}/api/v1/categories`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie(tokens.owner),
            ...organizationHeader,
          },
          body: JSON.stringify({
            name: "Owner Created Category",
            description: "Created through the protected production API.",
          }),
        });

        const payload = await response.json();

        assert.equal(response.status, 201);
        assert.equal(payload.success, true);
        assert.equal(payload.data.name, "Owner Created Category");
        assert.equal(payload.data.organizationId, organization.id);

        categoryIds.push(payload.data.id);
      });

      await t.test("MEMBER can read categories", async () => {
        const response = await fetch(`${baseUrl}/api/v1/categories`, {
          headers: {
            Cookie: cookie(tokens.member),
            ...organizationHeader,
          },
        });

        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.success, true);
      });

      await t.test("MEMBER cannot create categories", async () => {
        const response = await fetch(`${baseUrl}/api/v1/categories`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie(tokens.member),
            ...organizationHeader,
          },
          body: JSON.stringify({
            name: "Member Forbidden Category",
          }),
        });

        const payload = await response.json();

        assert.equal(response.status, 403);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "FORBIDDEN");
      });

      await t.test("ANALYST can read categories", async () => {
        const response = await fetch(`${baseUrl}/api/v1/categories`, {
          headers: {
            Cookie: cookie(tokens.analyst),
            ...organizationHeader,
          },
        });

        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.success, true);
      });

      await t.test("ANALYST cannot create categories", async () => {
        const response = await fetch(`${baseUrl}/api/v1/categories`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie(tokens.analyst),
            ...organizationHeader,
          },
          body: JSON.stringify({
            name: "Analyst Forbidden Category",
          }),
        });

        const payload = await response.json();

        assert.equal(response.status, 403);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "FORBIDDEN");
      });

      await t.test(
        "rejects users without membership in the selected organization",
        async () => {
          const response = await fetch(`${baseUrl}/api/v1/categories`, {
            headers: {
              Cookie: cookie(tokens.outsider),
              ...organizationHeader,
            },
          });

          const payload = await response.json();

          assert.equal(response.status, 403);
          assert.equal(payload.success, false);
          assert.equal(payload.error.code, "ORGANIZATION_ACCESS_DENIED");
        },
      );

      await t.test(
        "does not expose another organization's category",
        async () => {
          const response = await fetch(
            `${baseUrl}/api/v1/categories/${existingCategory.id}`,
            {
              headers: {
                Cookie: cookie(tokens.outsider),
                "X-Organization-Id": outsiderOrganization.id,
              },
            },
          );

          const payload = await response.json();

          assert.equal(response.status, 404);
          assert.equal(payload.success, false);
          assert.equal(payload.error.code, "CATEGORY_NOT_FOUND");
        },
      );
    });
  } finally {
    // Remove only records created by this test run.
    if (categoryIds.length > 0) {
      await prisma.category.deleteMany({
        where: { id: { in: categoryIds } },
      });
    }

    if (userIds.length > 0) {
      await prisma.session.deleteMany({
        where: { userId: { in: userIds } },
      });

      await prisma.membership.deleteMany({
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
