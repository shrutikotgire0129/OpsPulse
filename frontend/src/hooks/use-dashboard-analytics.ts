"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api";

export type DashboardRange = "7d" | "30d" | "90d" | "12m";

export interface DashboardAnalytics {
  period: {
    startDate: string;
    endDate: string;
    timezone: string;
    currencyCode: string;
  };
  revenueByCurrency: {
    currencyCode: string;
    grossRevenue: string;
    refunds: string;
    netRevenue: string;
  }[];
  revenueTrend: {
    currencyCode: string;
    points: {
      date: string;
      grossRevenue: string;
      refunds: string;
      netRevenue: string;
    }[];
  }[];
  ordersByCurrency: {
    currencyCode: string;
    orderCount: number;
    totalOrderValue: string;
    averageOrderValue: string;
  }[];
  totalOrders: number;
  newCustomers: number;
  salesChannels: {
    channel: string;
    currencyCode: string;
    orderCount: number;
    totalOrderValue: string;
  }[];
}

interface AnalyticsError {
  message: string;
  code: string;
  status: number;
}

type AnalyticsState =
  | { status: "loading" }
  | { status: "success"; data: DashboardAnalytics }
  | { status: "error"; error: AnalyticsError };

export function useDashboardAnalytics(
  organizationId: string | null,
  range: DashboardRange,
  startDate?: string,
  endDate?: string,
) {
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  const requestKey = [
    organizationId ?? "",
    range,
    startDate ?? "",
    endDate ?? "",
    retryCount,
  ].join("|");

  const [state, setState] = useState<{
    requestKey: string;
    result: AnalyticsState;
  } | null>(null);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    let active = true;

    const params = new URLSearchParams();

    params.set("range", range);

    if (startDate && endDate) {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }

    apiRequest<DashboardAnalytics>(
      `/api/v1/analytics/dashboard?${params.toString()}`,
      { organizationId },
    )
      .then((data) => {
        if (!active) return;

        setState({
          requestKey,
          result: { status: "success", data },
        });
      })
      .catch((cause: unknown) => {
        if (!active) return;

        const error =
          cause instanceof ApiError
            ? {
                message: cause.message,
                code: cause.code,
                status: cause.status,
              }
            : {
                message:
                  cause instanceof Error
                    ? cause.message
                    : "Unable to load dashboard analytics.",
                code: "UNKNOWN_ERROR",
                status: 0,
              };

        setState({
          requestKey,
          result: { status: "error", error },
        });
      });

    return () => {
      active = false;
    };
  }, [organizationId, range, startDate, endDate, requestKey, retryCount]);

  if (!organizationId) {
    return { status: "loading", retry } as const;
  }

  if (!state || state.requestKey !== requestKey) {
    return { status: "loading", retry } as const;
  }

  return { ...state.result, retry };
}
