"use client";

import { useState } from "react";
import {
  Activity,
  CalendarDays,
  ChevronDown,
  CreditCard,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/dashboard/metric-card";
import {
  useDashboardAnalytics,
  type DashboardRange,
} from "@/hooks/use-dashboard-analytics";
import { useAuth } from "@/lib/auth-context";
import { SalesChannels } from "@/components/dashboard/sales-channels";
import { RevenueChart } from "@/components/dashboard/revenue-chart";

const ranges: { label: string; value: DashboardRange }[] = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "Last 12 months", value: "12m" },
];

function formatCurrency(amount: string, currencyCode: string): string {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return `${currencyCode} ${amount}`;
  }

  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toFixed(2)}`;
  }
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return date;
  }

  const parsed = new Date(year, month - 1, day);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export default function Home() {
  const { user, selectedOrganization } = useAuth();

  const [range, setRange] = useState<DashboardRange>("30d");
  const [isRangeOpen, setIsRangeOpen] = useState(false);

  const [isCustomRange, setIsCustomRange] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState<
    string | undefined
  >();
  const [appliedEndDate, setAppliedEndDate] = useState<string | undefined>();

  const analytics = useDashboardAnalytics(
    selectedOrganization?.id ?? null,
    range,
    appliedStartDate,
    appliedEndDate,
  );

  const datesAreValid =
    draftStartDate !== "" &&
    draftEndDate !== "" &&
    draftStartDate <= draftEndDate;

  const hasDateOrderError =
    draftStartDate !== "" &&
    draftEndDate !== "" &&
    draftStartDate > draftEndDate;

  function selectPresetRange(value: DashboardRange) {
    setRange(value);
    setIsCustomRange(false);
    setAppliedStartDate(undefined);
    setAppliedEndDate(undefined);
    setIsRangeOpen(false);
  }

  function applyCustomRange() {
    if (!datesAreValid) {
      return;
    }

    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
    setIsCustomRange(true);
  }

  const revenueDescription =
    analytics.status === "success" &&
    analytics.data.revenueByCurrency.length > 1
      ? "Net revenue by currency"
      : "Net revenue for selected period";

  const revenueValue =
    analytics.status === "success"
      ? analytics.data.revenueByCurrency.length > 0
        ? analytics.data.revenueByCurrency
            .map((item) => formatCurrency(item.netRevenue, item.currencyCode))
            .join(" · ")
        : "—"
      : "—";

  const averageOrderValue =
    analytics.status === "success"
      ? analytics.data.ordersByCurrency.length > 0
        ? analytics.data.ordersByCurrency
            .map((item) =>
              formatCurrency(item.averageOrderValue, item.currencyCode),
            )
            .join(" · ")
        : "—"
      : "—";

  const periodLabel =
    analytics.status === "success"
      ? `${formatDate(analytics.data.period.startDate)} – ${formatDate(
          analytics.data.period.endDate,
        )}`
      : isCustomRange && appliedStartDate && appliedEndDate
        ? `${formatDate(appliedStartDate)} – ${formatDate(appliedEndDate)}`
        : (ranges.find((item) => item.value === range)?.label ?? "");

  return (
    <AppShell>
      <main className="mx-auto max-w-[1600px] space-y-7 px-5 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[23px] font-bold tracking-tight text-slate-900">
                Good day, {user?.name.split(" ")[0] ?? "there"}
              </h1>
              <span className="text-xl" aria-hidden="true">
                👋
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Here&apos;s what&apos;s happening with your business.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
            <CalendarDays size={15} className="text-slate-400" />
            {periodLabel}
          </div>
        </div>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-800">
              Business overview
            </h2>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Reporting period</span>

              <div
                className="relative"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setIsRangeOpen(false);
                  }
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsRangeOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={isRangeOpen}
                  onClick={() => setIsRangeOpen((open) => !open)}
                  className="flex min-w-[150px] items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition-colors hover:border-[#7955C8] focus-visible:ring-2 focus-visible:ring-[#7955C8]/20"
                >
                  {isCustomRange
                    ? "Custom range"
                    : ranges.find((item) => item.value === range)?.label}
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${isRangeOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isRangeOpen && (
                  <div
                    role="listbox"
                    aria-label="Reporting period"
                    className="absolute right-0 top-full z-30 mt-2 w-full overflow-hidden rounded-lg border border-border bg-white p-1 shadow-lg"
                  >
                    {ranges.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        role="option"
                        aria-selected={!isCustomRange && range === item.value}
                        onClick={() => selectPresetRange(item.value)}
                        className={`w-full rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-[#F1ECFA] hover:text-[#7955C8] ${
                          !isCustomRange && range === item.value
                            ? "font-semibold text-[#7955C8]"
                            : "font-medium text-slate-700"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}

                    <div className="my-1 border-t border-border" />

                    <button
                      type="button"
                      role="option"
                      aria-selected={isCustomRange}
                      onClick={() => {
                        setIsCustomRange(true);
                        setIsRangeOpen(false);
                      }}
                      className={`w-full rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-[#F1ECFA] hover:text-[#7955C8] ${
                        isCustomRange
                          ? "font-semibold text-[#7955C8]"
                          : "font-medium text-slate-700"
                      }`}
                    >
                      Custom range
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isCustomRange && (
            <div className="mb-4 rounded-xl border border-border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[180px] flex-1">
                  <label
                    htmlFor="analytics-start-date"
                    className="mb-2 block text-xs font-medium text-slate-600"
                  >
                    Start date
                  </label>
                  <input
                    id="analytics-start-date"
                    type="date"
                    value={draftStartDate}
                    max={draftEndDate || undefined}
                    onChange={(event) => setDraftStartDate(event.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#7955C8] focus:ring-2 focus:ring-[#7955C8]/20"
                  />
                </div>

                <div className="min-w-[180px] flex-1">
                  <label
                    htmlFor="analytics-end-date"
                    className="mb-2 block text-xs font-medium text-slate-600"
                  >
                    End date
                  </label>
                  <input
                    id="analytics-end-date"
                    type="date"
                    value={draftEndDate}
                    min={draftStartDate || undefined}
                    onChange={(event) => setDraftEndDate(event.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#7955C8] focus:ring-2 focus:ring-[#7955C8]/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={applyCustomRange}
                  disabled={!datesAreValid}
                  className="rounded-lg bg-[#7955C8] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#6845B5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Apply range
                </button>
              </div>

              {hasDateOrderError && (
                <p className="mt-3 text-xs text-red-600" role="alert">
                  Start date must not be after the end date.
                </p>
              )}

              {!draftStartDate || !draftEndDate ? (
                <p className="mt-3 text-xs text-slate-400">
                  Select both dates to apply a custom reporting period.
                </p>
              ) : null}

              {appliedStartDate &&
                appliedEndDate &&
                (draftStartDate !== appliedStartDate ||
                  draftEndDate !== appliedEndDate) && (
                  <p className="mt-3 text-xs text-slate-500">
                    You have changed the dates. Apply the range to refresh
                    analytics.
                  </p>
                )}
            </div>
          )}

          {analytics.status === "loading" && (
            <div
              className="rounded-xl border border-border bg-white p-8 text-center text-sm text-slate-500"
              role="status"
            >
              Loading organization analytics...
            </div>
          )}

          {analytics.status === "error" && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-5"
              role="alert"
            >
              <h3 className="text-sm font-semibold text-red-800">
                {analytics.error.status === 403
                  ? "Analytics access restricted"
                  : analytics.error.status === 401
                    ? "Your session has expired"
                    : "Unable to load analytics"}
              </h3>
              <p className="mt-1 text-sm text-red-700">
                {analytics.error.status === 403
                  ? "Your organization role does not have permission to view analytics. Contact an organization administrator."
                  : analytics.error.message}
              </p>
              <button
                type="button"
                onClick={analytics.retry}
                className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          )}

          {analytics.status === "success" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Net Revenue"
                value={revenueValue}
                description={revenueDescription}
                icon={Wallet}
                color="bg-[#F1ECFA] text-[#7955C8]"
              />

              <MetricCard
                title="Total Orders"
                value={analytics.data.totalOrders.toLocaleString("en-IN")}
                description="Orders in selected period"
                icon={ShoppingCart}
                color="bg-[#EAF3EF] text-[#268568]"
              />

              <MetricCard
                title="New Customers"
                value={analytics.data.newCustomers.toLocaleString("en-IN")}
                description="New customers in selected period"
                icon={Users}
                color="bg-[#F0EFF2] text-[#817A89]"
              />

              <MetricCard
                title="Average Order Value"
                value={averageOrderValue}
                description="By currency for selected period"
                icon={CreditCard}
                color="bg-[#FBF2E5] text-[#C58A32]"
              />
            </div>
          )}
        </section>

        {analytics.status === "success" && (
          <section className="rounded-xl border border-border bg-white p-5 shadow-sm shadow-slate-100/70 sm:p-6">
            <div className="flex items-center gap-2">
              <Activity size={17} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">
                Revenue breakdown
              </h2>
            </div>

            {analytics.data.revenueByCurrency.length === 0 ? (
              <p className="mt-5 text-sm text-slate-500">
                No revenue data is available for this reporting period.
              </p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {analytics.data.revenueByCurrency.map((item) => (
                  <div
                    key={item.currencyCode}
                    className="rounded-lg border border-border p-4"
                  >
                    <p className="text-xs font-medium text-slate-500">
                      {item.currencyCode} revenue
                    </p>
                    <p className="mt-2 text-xl font-bold text-slate-900">
                      {formatCurrency(item.netRevenue, item.currencyCode)}
                    </p>
                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                      <div className="flex justify-between gap-3">
                        <span>Gross revenue</span>
                        <span>
                          {formatCurrency(item.grossRevenue, item.currencyCode)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>Refunds</span>
                        <span>
                          {formatCurrency(item.refunds, item.currencyCode)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {analytics.status === "success" && (
          <RevenueChart revenueTrend={analytics.data.revenueTrend} />
        )}

        {analytics.status === "success" && (
          <SalesChannels
            channels={analytics.data.salesChannels}
            formatCurrency={formatCurrency}
          />
        )}

        {analytics.status === "success" && (
          <section className="rounded-xl border border-border bg-white p-5 shadow-sm shadow-slate-100/70 sm:p-6">
            <div className="flex items-center gap-2">
              <CreditCard size={17} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">
                Order performance by currency
              </h2>
            </div>

            {analytics.data.ordersByCurrency.length === 0 ? (
              <p className="mt-5 text-sm text-slate-500">
                No order data is available for this reporting period.
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[500px] text-left">
                  <thead>
                    <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-3">Currency</th>
                      <th className="px-3 py-3">Orders</th>
                      <th className="px-3 py-3">Order value</th>
                      <th className="px-3 py-3">Average value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.data.ordersByCurrency.map((item) => (
                      <tr key={item.currencyCode}>
                        <td className="px-3 py-4 text-xs font-semibold text-slate-800">
                          {item.currencyCode}
                        </td>
                        <td className="px-3 py-4 text-xs text-slate-600">
                          {item.orderCount.toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-4 text-xs text-slate-600">
                          {formatCurrency(
                            item.totalOrderValue,
                            item.currencyCode,
                          )}
                        </td>
                        <td className="px-3 py-4 text-xs text-slate-600">
                          {formatCurrency(
                            item.averageOrderValue,
                            item.currencyCode,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5 text-[11px] text-slate-400">
          <p>© 2026 OpsPulse. Business operations intelligence.</p>
          <p>
            {selectedOrganization?.name ?? "Workspace"} · {periodLabel}
          </p>
        </footer>
      </main>
    </AppShell>
  );
}
