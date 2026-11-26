import type { z } from "zod";

import type { dashboardQuerySchema } from "./analytics.schema.js";

/**
 * Validated dashboard query parameters.
 */
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/**
 * Organization context is resolved by authentication middleware.
 * It must never come from user-supplied request data.
 */
export interface AnalyticsContext {
  organizationId: string;
}

/**
 * Resolved reporting period.
 * Dates are inclusive calendar dates in the organization's timezone.
 */
export interface ReportingPeriod {
  startDate: string;
  endDate: string;
  timezone: string;
  currencyCode: string;
}

/**
 * Revenue totals for a single currency.
 * Monetary values are serialized as decimal strings.
 */
export interface CurrencyRevenue {
  currencyCode: string;
  grossRevenue: string;
  refunds: string;
  netRevenue: string;
}

/**
 * Order totals for a single currency.
 */
export interface CurrencyOrderAnalytics {
  currencyCode: string;
  orderCount: number;
  totalOrderValue: string;
  averageOrderValue: string;
}

/**
 * Sales channel performance for a single currency.
 */
export interface SalesChannelAnalytics {
  channel: string;
  currencyCode: string;
  orderCount: number;
  totalOrderValue: string;
}

/**
 * Revenue values for one reporting date or month.
 * Monetary values are serialized as decimal strings.
 */
export interface RevenueTrendPoint {
  date: string;
  grossRevenue: string;
  refunds: string;
  netRevenue: string;
}

/**
 * Revenue trend for one currency.
 * Different currencies must never share a series.
 */
export interface CurrencyRevenueTrend {
  currencyCode: string;
  points: RevenueTrendPoint[];
}

/**
 * Complete dashboard analytics response.
 */
export interface DashboardAnalytics {
  period: ReportingPeriod;
  revenueByCurrency: CurrencyRevenue[];
  revenueTrend: CurrencyRevenueTrend[];
  ordersByCurrency: CurrencyOrderAnalytics[];
  totalOrders: number;
  newCustomers: number;
  salesChannels: SalesChannelAnalytics[];
}

/**
 * Retained as a compatibility alias while existing analytics tests
 * and callers are migrated to the complete dashboard response.
 */
export type RevenueAnalytics = DashboardAnalytics;
