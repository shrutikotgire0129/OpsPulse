import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { metrics } from "@/lib/dashboard-data";

type Metric = (typeof metrics)[number];

export function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  const TrendIcon = metric.positive ? ArrowUpRight : ArrowDownRight;

  return (
    <article className="rounded-xl border border-border bg-white p-5 shadow-sm shadow-slate-100/70">
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-slate-500">
          {metric.title}
        </p>
        <div
          className={`flex size-9 items-center justify-center rounded-lg ${metric.color}`}
        >
          <Icon size={18} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[25px] font-bold tracking-tight text-slate-900">
          {metric.value}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
            metric.positive ? "text-emerald-600" : "text-red-600"
          }`}
        >
          <TrendIcon size={14} />
          {metric.change}
        </span>
        <span className="text-xs text-slate-400">{metric.description}</span>
      </div>
    </article>
  );
}
