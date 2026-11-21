import { channels } from "@/lib/dashboard-data";

export function SalesChannels() {
  return (
    <section className="rounded-xl border border-border bg-white p-5 shadow-sm shadow-slate-100/70 sm:p-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Sales by channel
        </h2>
        <p className="mt-1 text-xs text-slate-400">Revenue distribution</p>
      </div>

      <div className="mt-8">
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
          {channels.map((channel) => (
            <div
              key={channel.name}
              className={channel.color}
              style={{ width: `${channel.percentage}%` }}
            />
          ))}
        </div>

        <div className="mt-7 space-y-5">
          {channels.map((channel) => (
            <div key={channel.name}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${channel.color}`} />
                  <span className="text-xs font-medium text-slate-600">
                    {channel.name}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-800">
                  {channel.amount}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>{channel.percentage}% of total</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
