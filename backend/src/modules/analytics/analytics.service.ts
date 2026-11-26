import { Prisma } from "../../generated/prisma/client.js";

import { ApiError } from "../../lib/http/api-error.js";
import { prisma } from "../../lib/prisma.js";

import { resolveReportingPeriod } from "./analytics.dates.js";

import type {
  AnalyticsContext,
  CurrencyRevenueTrend,
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
  // REVENUE TREND
  // --------------------------------------------------

  const reportingDays =
    (Date.parse(`${period.endDate}T00:00:00Z`) -
      Date.parse(`${period.startDate}T00:00:00Z`)) /
      86_400_000 +
    1;

  const bucketUnit =
    query.range === "12m" ||
    (query.startDate !== undefined && reportingDays > 90)
      ? "month"
      : "day";

  const bucketInterval = bucketUnit === "month" ? "1 month" : "1 day";

  const paymentBucket = Prisma.sql`
    date_trunc(
      ${bucketUnit},
      (p."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${period.timezone}
    )::date
  `;

  const refundBucket = Prisma.sql`
    date_trunc(
      ${bucketUnit},
      (r."processedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${period.timezone}
    )::date
  `;

  const trendGroups = await prisma.$queryRaw<
    Array<{
      currencyCode: string;
      date: string;
      grossRevenue: string;
      refunds: string;
    }>
  >`
    WITH buckets AS (
      SELECT
        generate_series(
          date_trunc(
            ${bucketUnit},
            ${period.startDate}::date::timestamp
          ),
          date_trunc(
            ${bucketUnit},
            ${period.endDate}::date::timestamp
          ),
          ${bucketInterval}::interval
        )::date AS "bucketDate"
    ),

    currencies AS (
      SELECT p."currencyCode"
      FROM "Payment" AS p
      WHERE
        p."organizationId" = ${context.organizationId}
        AND p."status" IN (
          'SUCCEEDED',
          'PARTIALLY_REFUNDED',
          'REFUNDED'
        )
        AND p."paidAt" >= ${period.startInclusive}
        AND p."paidAt" < ${period.endExclusive}

      UNION

      SELECT p."currencyCode"
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
    ),

    events AS (
      SELECT
        p."currencyCode",
        ${paymentBucket} AS "bucketDate",
        SUM(p."amount") AS "grossRevenue",
        0::numeric AS "refunds"
      FROM "Payment" AS p
      WHERE
        p."organizationId" = ${context.organizationId}
        AND p."status" IN (
          'SUCCEEDED',
          'PARTIALLY_REFUNDED',
          'REFUNDED'
        )
        AND p."paidAt" >= ${period.startInclusive}
        AND p."paidAt" < ${period.endExclusive}
      GROUP BY 1, 2

      UNION ALL

      SELECT
        p."currencyCode",
        ${refundBucket} AS "bucketDate",
        0::numeric AS "grossRevenue",
        SUM(r."amount") AS "refunds"
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
      GROUP BY 1, 2
    ),

    totals AS (
      SELECT
        e."currencyCode",
        e."bucketDate",
        SUM(e."grossRevenue") AS "grossRevenue",
        SUM(e."refunds") AS "refunds"
      FROM events AS e
      GROUP BY
        e."currencyCode",
        e."bucketDate"
    )

    SELECT
      c."currencyCode" AS "currencyCode",
      TO_CHAR(b."bucketDate", 'YYYY-MM-DD') AS "date",
      COALESCE(t."grossRevenue", 0)::text AS "grossRevenue",
      COALESCE(t."refunds", 0)::text AS "refunds"
    FROM currencies AS c
    CROSS JOIN buckets AS b
    LEFT JOIN totals AS t
      ON t."currencyCode" = c."currencyCode"
      AND t."bucketDate" = b."bucketDate"
    ORDER BY
      c."currencyCode" ASC,
      b."bucketDate" ASC
  `;

  const trendByCurrency = new Map<string, CurrencyRevenueTrend["points"]>();

  for (const group of trendGroups) {
    const grossRevenue = new Prisma.Decimal(group.grossRevenue);
    const refunds = new Prisma.Decimal(group.refunds);

    const points = trendByCurrency.get(group.currencyCode) ?? [];

    points.push({
      date: group.date,
      grossRevenue: grossRevenue.toFixed(4),
      refunds: refunds.toFixed(4),
      netRevenue: grossRevenue.minus(refunds).toFixed(4),
    });

    trendByCurrency.set(group.currencyCode, points);
  }

  const revenueTrend = Array.from(trendByCurrency.entries())
    .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB))
    .map(([currencyCode, points]) => ({
      currencyCode,
      points,
    }));

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
    revenueTrend,
    ordersByCurrency,
    totalOrders,
    newCustomers,
    salesChannels,
  };
}
