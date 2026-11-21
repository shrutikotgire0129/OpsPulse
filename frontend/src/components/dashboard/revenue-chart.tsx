import { revenue } from "@/lib/dashboard-data";

export function RevenueChart() {
  return (
    <section className="rounded-xl border border-border bg-white p-5 shadow-sm shadow-slate-100/70 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Revenue overview
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Monthly revenue performance
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-600" />
            This year
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-slate-300" />
            Last year
          </span>
        </div>
      </div>

      <div className="mt-7 flex gap-3">
        <div className="flex h-[220px] flex-col justify-between pb-6 text-[10px] text-slate-400">
          <span>$100k</span>
          <span>$75k</span>
          <span>$50k</span>
          <span>$25k</span>
          <span>$0</span>
        </div>

        <div className="relative flex h-[220px] flex-1 flex-col justify-between pb-6">
          {[0, 1, 2, 3, 4].map((line) => (
            <div
              key={line}
              className="absolute left-0 right-0 border-t border-dashed border-slate-100"
              style={{ top: `${line * 25}%` }}
            />
          ))}

          <div className="absolute inset-0 flex items-end justify-between gap-1 pb-6">
            {revenue.map((item) => (
              <div
                key={item.month}
                className="flex h-full flex-1 items-end justify-center gap-1"
              >
                <div
                  className="w-[38%] rounded-t-[3px] bg-slate-200 transition-colors hover:bg-slate-300"
                  style={{ height: `${item.previous}%` }}
                  title={`${item.month}: last year`}
                />
                <div
                  className="w-[38%] rounded-t-[3px] bg-blue-600 transition-colors hover:bg-blue-700"
                  style={{ height: `${item.current}%` }}
                  title={`${item.month}: this year`}
                />
              </div>
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-slate-400">
            {revenue.map((item) => (
              <span key={item.month}>{item.month}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
