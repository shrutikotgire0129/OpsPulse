"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardAnalytics } from "@/hooks/use-dashboard-analytics";

type RevenueTrend = DashboardAnalytics["revenueTrend"];

interface RevenueChartProps {
  revenueTrend: RevenueTrend;
}

interface ChartPoint {
  date: string;
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
}

function formatCurrency(amount: number, currencyCode: string, compact = false) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(amount);
}

function formatDate(date: string, monthly: boolean) {
  const [year, month, day] = date.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    ...(monthly ? { year: "2-digit" as const } : { day: "numeric" as const }),
  }).format(parsedDate);
}

export function RevenueChart({ revenueTrend }: RevenueChartProps) {
  const [selectedCurrency, setSelectedCurrency] = useState("");

  const availableCurrencies = revenueTrend.filter(
    (currency) => currency.points.length > 0,
  );

  const activeCurrency =
    availableCurrencies.find(
      (currency) => currency.currencyCode === selectedCurrency,
    ) ?? availableCurrencies[0];

  const currencyCode = activeCurrency?.currencyCode ?? "INR";
  const monthly =
    (activeCurrency?.points.length ?? 0) > 1 &&
    Date.parse(`${activeCurrency!.points[1].date}T00:00:00Z`) -
      Date.parse(`${activeCurrency!.points[0].date}T00:00:00Z`) >
      2 * 24 * 60 * 60 * 1000;

  const chartData: ChartPoint[] = (activeCurrency?.points ?? []).map(
    (point) => ({
      date: point.date,
      grossRevenue: Number(point.grossRevenue),
      refunds: Number(point.refunds),
      netRevenue: Number(point.netRevenue),
    }),
  );

  return (
    <section className="rounded-xl border border-border bg-white p-5 shadow-sm shadow-slate-100/70 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Revenue overview
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Gross revenue, refunds and net revenue over time
          </p>
        </div>

        {availableCurrencies.length > 1 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="revenue-currency"
              className="text-xs text-slate-500"
            >
              Currency
            </label>
            <select
              id="revenue-currency"
              value={activeCurrency?.currencyCode ?? ""}
              onChange={(event) => setSelectedCurrency(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-[#7955C8] focus:ring-2 focus:ring-[#7955C8]/15"
            >
              {availableCurrencies.map((currency) => (
                <option
                  key={currency.currencyCode}
                  value={currency.currencyCode}
                >
                  {currency.currencyCode}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center">
          <p className="text-sm text-slate-400">
            No revenue data available for this period.
          </p>
        </div>
      ) : (
        <div className="mt-6 h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 8, bottom: 4 }}
            >
              <CartesianGrid
                stroke="#F1F0F5"
                strokeDasharray="4 4"
                vertical={false}
              />

              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => formatDate(value, monthly)}
                tick={{ fill: "#94A3B8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />

              <YAxis
                tickFormatter={(value: number) =>
                  formatCurrency(value, currencyCode, true)
                }
                tick={{ fill: "#94A3B8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={76}
              />

              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(Number(value ?? 0), currencyCode),
                  name,
                ]}
                labelFormatter={(label) => formatDate(String(label), monthly)}
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  fontSize: "12px",
                }}
              />

              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} />

              <Line
                type="monotone"
                dataKey="grossRevenue"
                name="Gross revenue"
                stroke="#94A3B8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />

              <Line
                type="monotone"
                dataKey="refunds"
                name="Refunds"
                stroke="#E58B8B"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />

              <Line
                type="monotone"
                dataKey="netRevenue"
                name="Net revenue"
                stroke="#7955C8"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
