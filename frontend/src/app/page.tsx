import { Activity, CalendarDays, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SalesChannels } from "@/components/dashboard/sales-channels";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { metrics } from "@/lib/dashboard-data";

export default function Home() {
  return (
    <AppShell>
      <main className="mx-auto max-w-[1600px] space-y-7 px-5 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[23px] font-bold tracking-tight text-slate-900">
                Good morning, Admin
              </h1>
              <span className="text-xl" aria-hidden="true">
                👋
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Here&apos;s what&apos;s happening with your business today.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
            <CalendarDays size={15} className="text-slate-400" />
            November 21, 2026
            <ChevronDown size={14} className="text-slate-400" />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs text-blue-800">
          <Activity size={15} />
          <span>
            You&apos;re viewing the OpsPulse dashboard with sample data.
          </span>
          <span className="ml-auto hidden font-semibold sm:block">DEMO</span>
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Business overview
            </h2>
            <span className="text-[11px] text-slate-400">Last 30 days</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard key={metric.title} metric={metric} />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.8fr_1fr]">
          <RevenueChart />
          <SalesChannels />
        </section>

        <RecentOrders />

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5 text-[11px] text-slate-400">
          <p>© 2026 OpsPulse. Business operations intelligence.</p>
          <p>Dashboard preview · Sample data</p>
        </footer>
      </main>
    </AppShell>
  );
}
