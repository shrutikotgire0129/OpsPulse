import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Express } from "express";
import test from "node:test";

import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import {
  generateSessionToken,
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "../src/modules/auth/session.js";
import { app } from "../src/app.js";

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

test("Analytics dashboard API integration", async (t) => {
  // Safety guard: never run against the development database.
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.replace(/^\/+/, ""),
  );

  assert.equal(
    databaseName,
    "opspulse_test",
    `Analytics API tests require database "opspulse_test", received "${databaseName}". No test records were created.`,
  );

  const uniqueId = randomUUID().replace(/-/g, "");

  const userIds: string[] = [];
  const organizationIds: string[] = [];

  const tokens = {
    owner: generateSessionToken(),
    analyst: generateSessionToken(),
    member: generateSessionToken(),
    outsider: generateSessionToken(),
  };

  const startDate = "2026-11-01";
  const endDate = "2026-11-30";

  try {
    // Create users for the four authorization scenarios.
    const [owner, analyst, member, outsider] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Analytics API Owner",
          email: `analytics-api-owner-${uniqueId}@example.com`,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          name: "Analytics API Analyst",
          email: `analytics-api-analyst-${uniqueId}@example.com`,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          name: "Analytics API Member",
          email: `analytics-api-member-${uniqueId}@example.com`,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          name: "Analytics API Outsider",
          email: `analytics-api-outsider-${uniqueId}@example.com`,
        },
        select: { id: true },
      }),
    ]);

    userIds.push(owner.id, analyst.id, member.id, outsider.id);

    // Organization A contains OWNER, ANALYST and MEMBER.
    const organizationA = await prisma.organization.create({
      data: {
        name: `Analytics API Organization A ${uniqueId}`,
        slug: `analytics-api-a-${uniqueId}`,
        currencyCode: "INR",
        timezone: "UTC",
      },
      select: { id: true },
    });

    organizationIds.push(organizationA.id);

    // Organization B belongs exclusively to the outsider.
    const organizationB = await prisma.organization.create({
      data: {
        name: `Analytics API Organization B ${uniqueId}`,
        slug: `analytics-api-b-${uniqueId}`,
        currencyCode: "USD",
        timezone: "UTC",
      },
      select: { id: true },
    });

    organizationIds.push(organizationB.id);

    await prisma.membership.createMany({
      data: [
        {
          userId: owner.id,
          organizationId: organizationA.id,
          role: "OWNER",
        },
        {
          userId: analyst.id,
          organizationId: organizationA.id,
          role: "ANALYST",
        },
        {
          userId: member.id,
          organizationId: organizationA.id,
          role: "MEMBER",
        },
        {
          userId: outsider.id,
          organizationId: organizationB.id,
          role: "OWNER",
        },
      ],
    });

    // Store only session token hashes.
    await prisma.session.createMany({
      data: [
        {
          userId: owner.id,
          tokenHash: hashSessionToken(tokens.owner),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        {
          userId: analyst.id,
          tokenHash: hashSessionToken(tokens.analyst),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        {
          userId: member.id,
          tokenHash: hashSessionToken(tokens.member),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        {
          userId: outsider.id,
          tokenHash: hashSessionToken(tokens.outsider),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      ],
    });

    // Seed Organization A's captured INR payment.
    const orderA = await prisma.order.create({
      data: {
        organizationId: organizationA.id,
        orderNumber: `AN-API-A-${uniqueId}`,
        status: "PENDING",
        placedAt: new Date("2026-11-15T12:00:00.000Z"),
        channel: "API",
        currencyCode: "INR",
        subtotal: "100.0000",
        discountTotal: "0",
        taxTotal: "0",
        shippingTotal: "0",
        grandTotal: "100.0000",
      },
      select: { id: true },
    });

    await prisma.payment
      .create({
        data: {
          organizationId: organizationA.id,
          orderId: orderA.id,
          amount: "100.0000",
          currencyCode: "INR",
          status: "PARTIALLY_REFUNDED",
          method: "OTHER",
          idempotencyKey: `analytics-api-payment-a-${uniqueId}`,
          paidAt: new Date("2026-11-15T12:00:00.000Z"),
        },
      })
      .then(async (payment) => {
        await prisma.paymentRefund.create({
          data: {
            organizationId: organizationA.id,
            paymentId: payment.id,
            amount: "20.0000",
            status: "SUCCEEDED",
            idempotencyKey: `analytics-api-refund-a-${uniqueId}`,
            processedAt: new Date("2026-11-16T12:00:00.000Z"),
          },
        });
      });

    // Seed Organization B's separate USD payment.
    const orderB = await prisma.order.create({
      data: {
        organizationId: organizationB.id,
        orderNumber: `AN-API-B-${uniqueId}`,
        status: "PENDING",
        currencyCode: "USD",
        subtotal: "999.0000",
        discountTotal: "0",
        taxTotal: "0",
        shippingTotal: "0",
        grandTotal: "999.0000",
        placedAt: new Date("2026-11-15T12:00:00.000Z"),
        channel: "API",
      },
      select: { id: true },
    });

    await prisma.payment.create({
      data: {
        organizationId: organizationB.id,
        orderId: orderB.id,
        amount: "999.0000",
        currencyCode: "USD",
        status: "SUCCEEDED",
        method: "OTHER",
        idempotencyKey: `analytics-api-payment-b-${uniqueId}`,
        paidAt: new Date("2026-11-15T12:00:00.000Z"),
      },
    });

    // Seed one new customer in each organization.
    await prisma.customer.create({
      data: {
        organizationId: organizationA.id,
        firstName: "Analytics",
        lastName: "Customer A",
        email: `analytics-api-customer-a-${uniqueId}@example.com`,
        status: "ACTIVE",
        createdAt: new Date("2026-11-15T12:00:00.000Z"),
      },
    });

    await prisma.customer.create({
      data: {
        organizationId: organizationB.id,
        firstName: "Analytics",
        lastName: "Customer B",
        email: `analytics-api-customer-b-${uniqueId}@example.com`,
        status: "ARCHIVED",
        createdAt: new Date("2026-11-15T12:00:00.000Z"),
      },
    });

    const cookie = (token: string) => `${SESSION_COOKIE_NAME}=${token}`;

    const organizationAHeader = {
      "X-Organization-Id": organizationA.id,
    };

    const dashboardUrl = `/api/v1/analytics/dashboard?startDate=${startDate}&endDate=${endDate}`;

    await withServer(app, async (baseUrl) => {
      await t.test("rejects unauthenticated requests", async () => {
        const response = await fetch(`${baseUrl}/api/v1/analytics/dashboard`);

        const payload = await response.json();

        assert.equal(response.status, 401);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "UNAUTHENTICATED");
      });

      await t.test(
        "rejects authenticated requests without organization selection",
        async () => {
          const response = await fetch(`${baseUrl}${dashboardUrl}`, {
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

      await t.test("OWNER receives accurate revenue analytics", async () => {
        const response = await fetch(`${baseUrl}${dashboardUrl}`, {
          headers: {
            Cookie: cookie(tokens.owner),
            ...organizationAHeader,
          },
        });

        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.success, true);

        assert.deepEqual(payload.data.revenueByCurrency, [
          {
            currencyCode: "INR",
            grossRevenue: "100.0000",
            refunds: "20.0000",
            netRevenue: "80.0000",
          },
        ]);

        assert.deepEqual(payload.data.ordersByCurrency, [
          {
            currencyCode: "INR",
            orderCount: 1,
            totalOrderValue: "100.0000",
            averageOrderValue: "100.0000",
          },
        ]);

        assert.equal(payload.data.totalOrders, 1);
        assert.equal(payload.data.newCustomers, 1);

        assert.deepEqual(payload.data.salesChannels, [
          {
            channel: "API",
            currencyCode: "INR",
            orderCount: 1,
            totalOrderValue: "100.0000",
          },
        ]);

        assert.equal(payload.data.period.startDate, startDate);
        assert.equal(payload.data.period.endDate, endDate);
        assert.equal(payload.data.period.timezone, "UTC");
        assert.equal(payload.data.period.currencyCode, "INR");
      });

      await t.test("ANALYST can read revenue analytics", async () => {
        const response = await fetch(`${baseUrl}${dashboardUrl}`, {
          headers: {
            Cookie: cookie(tokens.analyst),
            ...organizationAHeader,
          },
        });

        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.success, true);
        assert.deepEqual(payload.data.revenueByCurrency, [
          {
            currencyCode: "INR",
            grossRevenue: "100.0000",
            refunds: "20.0000",
            netRevenue: "80.0000",
          },
        ]);
        assert.deepEqual(payload.data.ordersByCurrency, [
          {
            currencyCode: "INR",
            orderCount: 1,
            totalOrderValue: "100.0000",
            averageOrderValue: "100.0000",
          },
        ]);

        assert.equal(payload.data.totalOrders, 1);
        assert.equal(payload.data.newCustomers, 1);

        assert.deepEqual(payload.data.salesChannels, [
          {
            channel: "API",
            currencyCode: "INR",
            orderCount: 1,
            totalOrderValue: "100.0000",
          },
        ]);
      });

      await t.test("MEMBER cannot read revenue analytics", async () => {
        const response = await fetch(`${baseUrl}${dashboardUrl}`, {
          headers: {
            Cookie: cookie(tokens.member),
            ...organizationAHeader,
          },
        });

        const payload = await response.json();

        assert.equal(response.status, 403);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "FORBIDDEN");
      });

      await t.test(
        "outsider sees only their selected organization's revenue",
        async () => {
          const response = await fetch(`${baseUrl}${dashboardUrl}`, {
            headers: {
              Cookie: cookie(tokens.outsider),
              "X-Organization-Id": organizationB.id,
            },
          });

          const payload = await response.json();

          assert.equal(response.status, 200);
          assert.equal(payload.success, true);

          assert.deepEqual(payload.data.revenueByCurrency, [
            {
              currencyCode: "USD",
              grossRevenue: "999.0000",
              refunds: "0.0000",
              netRevenue: "999.0000",
            },
          ]);
          assert.deepEqual(payload.data.ordersByCurrency, [
            {
              currencyCode: "USD",
              orderCount: 1,
              totalOrderValue: "999.0000",
              averageOrderValue: "999.0000",
            },
          ]);

          assert.equal(payload.data.totalOrders, 1);
          assert.equal(payload.data.newCustomers, 1);

          assert.deepEqual(payload.data.salesChannels, [
            {
              channel: "API",
              currencyCode: "USD",
              orderCount: 1,
              totalOrderValue: "999.0000",
            },
          ]);
        },
      );

      await t.test(
        "rejects users without membership in the selected organization",
        async () => {
          const response = await fetch(`${baseUrl}${dashboardUrl}`, {
            headers: {
              Cookie: cookie(tokens.outsider),
              ...organizationAHeader,
            },
          });

          const payload = await response.json();

          assert.equal(response.status, 403);
          assert.equal(payload.success, false);
          assert.equal(payload.error.code, "ORGANIZATION_ACCESS_DENIED");
        },
      );

      await t.test("rejects invalid calendar dates", async () => {
        const response = await fetch(
          `${baseUrl}/api/v1/analytics/dashboard?startDate=2026-02-30&endDate=2026-03-01`,
          {
            headers: {
              Cookie: cookie(tokens.owner),
              ...organizationAHeader,
            },
          },
        );

        const payload = await response.json();

        assert.equal(response.status, 400);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "VALIDATION_ERROR");
      });

      await t.test("rejects incomplete custom date ranges", async () => {
        const response = await fetch(
          `${baseUrl}/api/v1/analytics/dashboard?startDate=2026-11-01`,
          {
            headers: {
              Cookie: cookie(tokens.owner),
              ...organizationAHeader,
            },
          },
        );

        const payload = await response.json();

        assert.equal(response.status, 400);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "VALIDATION_ERROR");
      });

      await t.test("rejects unknown query parameters", async () => {
        const response = await fetch(
          `${baseUrl}/api/v1/analytics/dashboard?unexpected=value`,
          {
            headers: {
              Cookie: cookie(tokens.owner),
              ...organizationAHeader,
            },
          },
        );

        const payload = await response.json();

        assert.equal(response.status, 400);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, "VALIDATION_ERROR");
      });
    });
  } finally {
    // Remove only records created by this test run.
    if (organizationIds.length > 0) {
      await prisma.paymentProviderEvent.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });

      await prisma.paymentRefund.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });

      await prisma.payment.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });

      await prisma.orderItem.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });

      await prisma.order.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });
    }

    if (userIds.length > 0) {
      await prisma.session.deleteMany({
        where: {
          userId: { in: userIds },
        },
      });

      await prisma.membership.deleteMany({
        where: {
          userId: { in: userIds },
        },
      });
    }

    if (organizationIds.length > 0) {
      await prisma.organization.deleteMany({
        where: {
          id: { in: organizationIds },
        },
      });
    }

    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: { in: userIds },
        },
      });
    }

    await prisma.$disconnect();
  }
});
