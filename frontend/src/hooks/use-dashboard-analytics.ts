"use client";

import { useEffect, useState } from "react";
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
  | {
      status: "loading";
    }
  | {
      status: "success";
      data: DashboardAnalytics;
    }
  | {
      status: "error";
      error: AnalyticsError;
    };

export function useDashboardAnalytics(
  organizationId: string | null,
  range: DashboardRange,
) {
  const [state, setState] = useState<{
    organizationId: string;
    range: DashboardRange;
    result: AnalyticsState;
  } | null>(null);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    let active = true;

    apiRequest<DashboardAnalytics>(
      `/api/v1/analytics/dashboard?range=${range}`,
      {
        organizationId,
      },
    )
      .then((data) => {
        if (!active) return;

        setState({
          organizationId,
          range,
          result: {
            status: "success",
            data,
          },
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
          organizationId,
          range,
          result: {
            status: "error",
            error,
          },
        });
      });

    return () => {
      active = false;
    };
  }, [organizationId, range]);

  if (!organizationId) {
    return { status: "loading" } as const;
  }

  if (
    !state ||
    state.organizationId !== organizationId ||
    state.range !== range
  ) {
    return { status: "loading" } as const;
  }

  return state.result;
}
