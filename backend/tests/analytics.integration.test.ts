import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { Prisma } from "../src/generated/prisma/client.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";

import { getRevenueAnalytics } from "../src/modules/analytics/analytics.service.js";
import { dashboardQuerySchema } from "../src/modules/analytics/analytics.schema.js";

import type { AnalyticsContext } from "../src/modules/analytics/analytics.types.js";

test("Analytics service PostgreSQL integration", async (t) => {
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.replace(/^\/+/, ""),
  );

  assert.equal(
    databaseName,
    "opspulse_test",
    `Integration tests require database "opspulse_test", received "${databaseName}". No test records were created.`,
  );

  const uniqueId = randomUUID().replace(/-/g, "");
  const organizationIds: string[] = [];

  const startDate = new Date("2026-11-01T00:00:00.000Z");
  const endDate = new Date("2026-12-01T00:00:00.000Z");

  try {
    const firstOrganization = await prisma.organization.create({
      data: {
        name: `Analytics Organization A ${uniqueId}`,
        slug: `opspulse-analytics-a-${uniqueId}`,
        currencyCode: "INR",
        timezone: "UTC",
      },
    });

    organizationIds.push(firstOrganization.id);

    const secondOrganization = await prisma.organization.create({
      data: {
        name: `Analytics Organization B ${uniqueId}`,
        slug: `opspulse-analytics-b-${uniqueId}`,
        currencyCode: "USD",
        timezone: "UTC",
      },
    });

    organizationIds.push(secondOrganization.id);

    const firstContext: AnalyticsContext = {
      organizationId: firstOrganization.id,
    };

    const secondContext: AnalyticsContext = {
      organizationId: secondOrganization.id,
    };

    let orderCounter = 0;
    let paymentCounter = 0;
    let refundCounter = 0;

    async function createPaymentFixture(
      organizationId: string,
      currencyCode: string,
      amount: string,
      status:
        | "PENDING"
        | "SUCCEEDED"
        | "PARTIALLY_REFUNDED"
        | "REFUNDED"
        | "FAILED",
      paidAt: Date | null,
    ) {
      orderCounter += 1;
      paymentCounter += 1;

      const order = await prisma.order.create({
        data: {
          organizationId,
          orderNumber: `AN-${uniqueId}-${orderCounter}`,
          status: "DRAFT",
          currencyCode,
          subtotal: amount,
          discountTotal: "0",
          taxTotal: "0",
          shippingTotal: "0",
          grandTotal: amount,
        },
      });

      return prisma.payment.create({
        data: {
          organizationId,
          orderId: order.id,
          amount,
          currencyCode,
          status,
          method: "OTHER",
          idempotencyKey: `analytics-${uniqueId}-${paymentCounter}`,
          paidAt,
        },
      });
    }

    async function createOrderFixture(input: {
      organizationId: string;
      currencyCode: string;
      amount: string;
      status:
        | "DRAFT"
        | "PENDING"
        | "CONFIRMED"
        | "PROCESSING"
        | "SHIPPED"
        | "DELIVERED"
        | "CANCELLED"
        | "REFUNDED";
      placedAt: Date | null;
      createdAt: Date;
      channel: string | null;
    }) {
      orderCounter += 1;

      return prisma.order.create({
        data: {
          organizationId: input.organizationId,
          orderNumber: `AN-ORDER-${uniqueId}-${orderCounter}`,
          status: input.status,
          currencyCode: input.currencyCode,
          subtotal: input.amount,
          discountTotal: "0",
          taxTotal: "0",
          shippingTotal: "0",
          grandTotal: input.amount,
          placedAt: input.placedAt,
          createdAt: input.createdAt,
          channel: input.channel,
        },
      });
    }

    async function createRefundFixture(
      organizationId: string,
      paymentId: string,
      amount: string,
      status: "PENDING" | "SUCCEEDED",
      processedAt: Date | null,
    ) {
      refundCounter += 1;

      return prisma.paymentRefund.create({
        data: {
          organizationId,
          paymentId,
          amount,
          status,
          idempotencyKey: `analytics-refund-${uniqueId}-${refundCounter}`,
          processedAt,
        },
      });
    }

    await t.test(
      "aggregates captured revenue and successful refunds by currency",
      async () => {
        const insidePeriod = new Date("2026-11-15T12:00:00.000Z");

        // INR captured payments: 100 + 50 + 25 = 175.
        const successfulInr = await createPaymentFixture(
          firstOrganization.id,
          "INR",
          "100.0000",
          "SUCCEEDED",
          insidePeriod,
        );

        const partiallyRefundedInr = await createPaymentFixture(
          firstOrganization.id,
          "INR",
          "50.0000",
          "PARTIALLY_REFUNDED",
          insidePeriod,
        );

        const refundedInr = await createPaymentFixture(
          firstOrganization.id,
          "INR",
          "25.0000",
          "REFUNDED",
          insidePeriod,
        );

        // EUR captured payments: 20.
        const successfulEur = await createPaymentFixture(
          firstOrganization.id,
          "EUR",
          "20.0000",
          "SUCCEEDED",
          insidePeriod,
        );

        // These payments must not contribute to captured revenue.
        await createPaymentFixture(
          firstOrganization.id,
          "INR",
          "500.0000",
          "PENDING",
          null,
        );

        await createPaymentFixture(
          firstOrganization.id,
          "INR",
          "600.0000",
          "FAILED",
          null,
        );

        // Payment outside the reporting period must be excluded.
        await createPaymentFixture(
          firstOrganization.id,
          "INR",
          "700.0000",
          "SUCCEEDED",
          new Date("2026-12-01T00:00:00.000Z"),
        );

        // Successful refunds only.
        await createRefundFixture(
          firstOrganization.id,
          successfulInr.id,
          "10.0000",
          "SUCCEEDED",
          insidePeriod,
        );

        await createRefundFixture(
          firstOrganization.id,
          partiallyRefundedInr.id,
          "15.0000",
          "SUCCEEDED",
          insidePeriod,
        );

        await createRefundFixture(
          firstOrganization.id,
          refundedInr.id,
          "25.0000",
          "SUCCEEDED",
          insidePeriod,
        );

        await createRefundFixture(
          firstOrganization.id,
          successfulEur.id,
          "5.0000",
          "SUCCEEDED",
          insidePeriod,
        );

        // Pending refunds must not be counted.
        await createRefundFixture(
          firstOrganization.id,
          successfulInr.id,
          "30.0000",
          "PENDING",
          null,
        );

        // A successful refund processed outside the period is excluded.
        await createRefundFixture(
          firstOrganization.id,
          successfulInr.id,
          "5.0000",
          "SUCCEEDED",
          new Date("2026-12-01T00:00:00.000Z"),
        );

        // Another organization's financial records must never leak.
        const otherOrganizationPayment = await createPaymentFixture(
          secondOrganization.id,
          "USD",
          "9999.0000",
          "SUCCEEDED",
          insidePeriod,
        );

        await createRefundFixture(
          secondOrganization.id,
          otherOrganizationPayment.id,
          "100.0000",
          "SUCCEEDED",
          insidePeriod,
        );

        const result = await getRevenueAnalytics(
          firstContext,
          dashboardQuerySchema.parse({
            startDate: "2026-11-01",
            endDate: "2026-11-30",
          }),
        );

        assert.deepEqual(result.period, {
          startDate: "2026-11-01",
          endDate: "2026-11-30",
          timezone: "UTC",
          currencyCode: "INR",
        });

        assert.equal(result.revenueByCurrency.length, 2);

        assert.deepEqual(result.revenueByCurrency, [
          {
            currencyCode: "EUR",
            grossRevenue: "20.0000",
            refunds: "5.0000",
            netRevenue: "15.0000",
          },
          {
            currencyCode: "INR",
            grossRevenue: "175.0000",
            refunds: "50.0000",
            netRevenue: "125.0000",
          },
        ]);
      },
    );

    await t.test(
      "aggregates orders, average order value, customers, and channels independently",
      async () => {
        const insidePeriod = new Date("2026-11-15T12:00:00.000Z");
        const outsidePeriod = new Date("2026-12-02T12:00:00.000Z");

        // Eligible INR order: placedAt is authoritative even when
        // createdAt falls outside the reporting period.
        await createOrderFixture({
          organizationId: firstOrganization.id,
          currencyCode: "INR",
          amount: "100.0000",
          status: "PENDING",
          placedAt: insidePeriod,
          createdAt: outsidePeriod,
          channel: "ONLINE",
        });

        // Eligible INR order: createdAt is used when placedAt is null.
        await createOrderFixture({
          organizationId: firstOrganization.id,
          currencyCode: "INR",
          amount: "200.0000",
          status: "DELIVERED",
          placedAt: null,
          createdAt: insidePeriod,
          channel: "   ",
        });

        // Eligible EUR order, kept separate from INR.
        await createOrderFixture({
          organizationId: firstOrganization.id,
          currencyCode: "EUR",
          amount: "50.0000",
          status: "PROCESSING",
          placedAt: insidePeriod,
          createdAt: insidePeriod,
          channel: "MARKETPLACE",
        });

        // Eligible INR order with a database NULL channel.
        await createOrderFixture({
          organizationId: firstOrganization.id,
          currencyCode: "INR",
          amount: "75.0000",
          status: "DELIVERED",
          placedAt: insidePeriod,
          createdAt: insidePeriod,
          channel: null,
        });

        // DRAFT and CANCELLED orders must be excluded.
        await createOrderFixture({
          organizationId: firstOrganization.id,
          currencyCode: "INR",
          amount: "400.0000",
          status: "DRAFT",
          placedAt: insidePeriod,
          createdAt: insidePeriod,
          channel: "ONLINE",
        });

        await createOrderFixture({
          organizationId: firstOrganization.id,
          currencyCode: "INR",
          amount: "500.0000",
          status: "CANCELLED",
          placedAt: insidePeriod,
          createdAt: insidePeriod,
          channel: "ONLINE",
        });

        // A non-null placedAt outside the period must not fall back
        // to an in-period createdAt.
        await createOrderFixture({
          organizationId: firstOrganization.id,
          currencyCode: "INR",
          amount: "600.0000",
          status: "REFUNDED",
          placedAt: new Date("2026-12-01T00:00:00.000Z"),
          createdAt: insidePeriod,
          channel: "ONLINE",
        });

        // Another organization's order must not leak into this result.
        await createOrderFixture({
          organizationId: secondOrganization.id,
          currencyCode: "USD",
          amount: "9999.0000",
          status: "DELIVERED",
          placedAt: insidePeriod,
          createdAt: insidePeriod,
          channel: "ONLINE",
        });

        // New customers include both ACTIVE and ARCHIVED statuses.
        await prisma.customer.create({
          data: {
            organizationId: firstOrganization.id,
            firstName: "Active",
            lastName: "Analytics Customer",
            email: `analytics-active-${uniqueId}@example.com`,
            status: "ACTIVE",
            createdAt: insidePeriod,
          },
        });

        await prisma.customer.create({
          data: {
            organizationId: firstOrganization.id,
            firstName: "Archived",
            lastName: "Analytics Customer",
            email: `analytics-archived-${uniqueId}@example.com`,
            status: "ARCHIVED",
            createdAt: insidePeriod,
          },
        });

        // Customer created outside the reporting period is excluded.
        await prisma.customer.create({
          data: {
            organizationId: firstOrganization.id,
            firstName: "Old",
            lastName: "Analytics Customer",
            email: `analytics-old-${uniqueId}@example.com`,
            status: "ACTIVE",
            createdAt: outsidePeriod,
          },
        });

        // Another organization's customer must not leak into this result.
        await prisma.customer.create({
          data: {
            organizationId: secondOrganization.id,
            firstName: "Foreign",
            lastName: "Analytics Customer",
            email: `analytics-foreign-${uniqueId}@example.com`,
            status: "ACTIVE",
            createdAt: insidePeriod,
          },
        });

        const result = await getRevenueAnalytics(
          firstContext,
          dashboardQuerySchema.parse({
            startDate: "2026-11-01",
            endDate: "2026-11-30",
          }),
        );

        assert.equal(result.totalOrders, 4);

        assert.deepEqual(result.ordersByCurrency, [
          {
            currencyCode: "EUR",
            orderCount: 1,
            totalOrderValue: "50.0000",
            averageOrderValue: "50.0000",
          },
          {
            currencyCode: "INR",
            orderCount: 3,
            totalOrderValue: "375.0000",
            averageOrderValue: "125.0000",
          },
        ]);

        assert.equal(result.newCustomers, 2);

        assert.deepEqual(result.salesChannels, [
          {
            channel: "MARKETPLACE",
            currencyCode: "EUR",
            orderCount: 1,
            totalOrderValue: "50.0000",
          },
          {
            channel: "ONLINE",
            currencyCode: "INR",
            orderCount: 1,
            totalOrderValue: "100.0000",
          },
          {
            channel: "Unattributed",
            currencyCode: "INR",
            orderCount: 2,
            totalOrderValue: "275.0000",
          },
        ]);

        // Verify organization B receives only its own dashboard metrics.
        const secondResult = await getRevenueAnalytics(
          secondContext,
          dashboardQuerySchema.parse({
            startDate: "2026-11-01",
            endDate: "2026-11-30",
          }),
        );

        assert.equal(secondResult.totalOrders, 1);
        assert.equal(secondResult.newCustomers, 1);

        assert.deepEqual(secondResult.ordersByCurrency, [
          {
            currencyCode: "USD",
            orderCount: 1,
            totalOrderValue: "9999.0000",
            averageOrderValue: "9999.0000",
          },
        ]);
      },
    );

    await t.test(
      "returns only the authenticated organization's revenue",
      async () => {
        const result = await getRevenueAnalytics(
          secondContext,
          dashboardQuerySchema.parse({
            startDate: "2026-11-01",
            endDate: "2026-11-30",
          }),
        );

        assert.deepEqual(result.revenueByCurrency, [
          {
            currencyCode: "USD",
            grossRevenue: "9999.0000",
            refunds: "100.0000",
            netRevenue: "9899.0000",
          },
        ]);
      },
    );

    await t.test("rejects a nonexistent organization", async () => {
      await assert.rejects(
        () =>
          getRevenueAnalytics(
            { organizationId: `missing-${uniqueId}` },
            dashboardQuerySchema.parse({
              startDate: "2026-11-01",
              endDate: "2026-11-30",
            }),
          ),
        (error: unknown) =>
          error instanceof Error &&
          "code" in error &&
          error.code === "ORGANIZATION_NOT_FOUND",
      );
    });
  } finally {
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

      await prisma.organization.deleteMany({
        where: {
          id: { in: organizationIds },
        },
      });
    }

    await prisma.$disconnect();
  }
});
