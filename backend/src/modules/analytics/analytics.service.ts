import { Prisma } from "../../generated/prisma/client.js";

import { ApiError } from "../../lib/http/api-error.js";
import { prisma } from "../../lib/prisma.js";

import { resolveReportingPeriod } from "./analytics.dates.js";

import type {
  AnalyticsContext,
  DashboardAnalytics,
  DashboardQuery,
} from "./analytics.types.js";

/**
 * Retrieves dashboard analytics for the authenticated organization.
 *
 * All monetary calculations use Prisma.Decimal.
 * Currency totals are never combined.
 *
 * Orders exclude DRAFT and CANCELLED statuses.
 * The reporting date is placedAt, falling back to createdAt.
 */
export async function getRevenueAnalytics(
  context: AnalyticsContext,
  query: DashboardQuery,
): Promise<DashboardAnalytics> {
  const organization = await prisma.organization.findUnique({
    where: {
      id: context.organizationId,
    },
    select: {
      id: true,
      currencyCode: true,
      timezone: true,
    },
  });

  if (!organization) {
    throw new ApiError(
      404,
      "ORGANIZATION_NOT_FOUND",
      "Organization not found.",
    );
  }

  const period = resolveReportingPeriod(
    query,
    organization.timezone,
    organization.currencyCode,
  );

  // --------------------------------------------------
  // REVENUE
  // --------------------------------------------------

  const paymentGroups = await prisma.payment.groupBy({
    by: ["currencyCode"],
    where: {
      organizationId: context.organizationId,
      status: {
        in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"],
      },
      paidAt: {
        gte: period.startInclusive,
        lt: period.endExclusive,
      },
    },
    _sum: {
      amount: true,
    },
  });

  /*
   * PaymentRefund has no currencyCode column.
   * Join through Payment using both paymentId and organizationId.
   */
  const refundGroups = await prisma.$queryRaw<
    Array<{
      currencyCode: string;
      total: string;
    }>
  >`
    SELECT
      p."currencyCode" AS "currencyCode",
      COALESCE(SUM(r."amount"), 0)::text AS "total"
    FROM "PaymentRefund" AS r
    INNER JOIN "Payment" AS p
      ON p."id" = r."paymentId"
      AND p."organizationId" = r."organizationId"
    WHERE
      r."organizationId" = ${context.organizationId}
      AND p."organizationId" = ${context.organizationId}
      AND r."status" = 'SUCCEEDED'
      AND r."processedAt" >= ${period.startInclusive}
      AND r."processedAt" < ${period.endExclusive}
    GROUP BY p."currencyCode"
  `;

  const currencies = new Map<
    string,
    {
      grossRevenue: Prisma.Decimal;
      refunds: Prisma.Decimal;
    }
  >();

  for (const group of paymentGroups) {
    currencies.set(group.currencyCode, {
      grossRevenue: new Prisma.Decimal(group._sum.amount?.toString() ?? "0"),
      refunds: new Prisma.Decimal(0),
    });
  }

  for (const group of refundGroups) {
    const existing = currencies.get(group.currencyCode);

    if (existing) {
      existing.refunds = new Prisma.Decimal(group.total);
    } else {
      currencies.set(group.currencyCode, {
        grossRevenue: new Prisma.Decimal(0),
        refunds: new Prisma.Decimal(group.total),
      });
    }
  }

  const revenueByCurrency = Array.from(currencies.entries())
    .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB))
    .map(([currencyCode, totals]) => ({
      currencyCode,
      grossRevenue: totals.grossRevenue.toFixed(4),
      refunds: totals.refunds.toFixed(4),
      netRevenue: totals.grossRevenue.minus(totals.refunds).toFixed(4),
    }));

  // --------------------------------------------------
  // ORDERS BY CURRENCY
  // --------------------------------------------------

  const orderGroups = await prisma.$queryRaw<
    Array<{
      currencyCode: string;
      orderCount: string;
      totalOrderValue: string;
    }>
  >`
    SELECT
      o."currencyCode" AS "currencyCode",
      COUNT(*)::text AS "orderCount",
      COALESCE(SUM(o."grandTotal"), 0)::text AS "totalOrderValue"
    FROM "Order" AS o
    WHERE
      o."organizationId" = ${context.organizationId}
      AND o."status" NOT IN ('DRAFT', 'CANCELLED')
      AND COALESCE(o."placedAt", o."createdAt") >= ${period.startInclusive}
      AND COALESCE(o."placedAt", o."createdAt") < ${period.endExclusive}
    GROUP BY o."currencyCode"
    ORDER BY o."currencyCode" ASC
  `;

  const ordersByCurrency = orderGroups.map((group) => {
    const orderCount = Number(group.orderCount);
    const totalOrderValue = new Prisma.Decimal(group.totalOrderValue);

    const averageOrderValue =
      orderCount > 0
        ? totalOrderValue.dividedBy(orderCount)
        : new Prisma.Decimal(0);

    return {
      currencyCode: group.currencyCode,
      orderCount,
      totalOrderValue: totalOrderValue.toFixed(4),
      averageOrderValue: averageOrderValue.toFixed(4),
    };
  });

  const totalOrders = ordersByCurrency.reduce(
    (total, group) => total + group.orderCount,
    0,
  );

  // --------------------------------------------------
  // NEW CUSTOMERS
  // --------------------------------------------------

  const newCustomers = await prisma.customer.count({
    where: {
      organizationId: context.organizationId,
      createdAt: {
        gte: period.startInclusive,
        lt: period.endExclusive,
      },
    },
  });

  // --------------------------------------------------
  // SALES CHANNELS
  // --------------------------------------------------

  const channelGroups = await prisma.$queryRaw<
    Array<{
      channel: string;
      currencyCode: string;
      orderCount: string;
      totalOrderValue: string;
    }>
  >`
    SELECT
      COALESCE(
        NULLIF(BTRIM(o."channel"), ''),
        'Unattributed'
      ) AS "channel",
      o."currencyCode" AS "currencyCode",
      COUNT(*)::text AS "orderCount",
      COALESCE(SUM(o."grandTotal"), 0)::text AS "totalOrderValue"
    FROM "Order" AS o
    WHERE
      o."organizationId" = ${context.organizationId}
      AND o."status" NOT IN ('DRAFT', 'CANCELLED')
      AND COALESCE(o."placedAt", o."createdAt") >= ${period.startInclusive}
      AND COALESCE(o."placedAt", o."createdAt") < ${period.endExclusive}
    GROUP BY
      COALESCE(
        NULLIF(BTRIM(o."channel"), ''),
        'Unattributed'
      ),
      o."currencyCode"
    ORDER BY
      o."currencyCode" ASC,
      "channel" ASC
  `;

  const salesChannels = channelGroups.map((group) => ({
    channel: group.channel,
    currencyCode: group.currencyCode,
    orderCount: Number(group.orderCount),
    totalOrderValue: new Prisma.Decimal(group.totalOrderValue).toFixed(4),
  }));

  // --------------------------------------------------
  // RESPONSE
  // --------------------------------------------------

  return {
    period: {
      startDate: period.startDate,
      endDate: period.endDate,
      timezone: period.timezone,
      currencyCode: period.currencyCode,
    },
    revenueByCurrency,
    ordersByCurrency,
    totalOrders,
    newCustomers,
    salesChannels,
  };
}
