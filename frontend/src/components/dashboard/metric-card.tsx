import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  color,
}: MetricCardProps) {
  return (
    <article className="rounded-xl border border-border bg-white p-5 shadow-sm shadow-slate-100/70">
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-slate-500">{title}</p>

        <div
          className={`flex size-9 items-center justify-center rounded-lg ${color}`}
        >
          <Icon size={18} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[25px] font-bold tracking-tight text-slate-900">
          {value}
        </p>
      </div>

      <p className="mt-3 text-xs text-slate-400">{description}</p>
    </article>
  );
}
