interface SalesChannel {
  channel: string;
  currencyCode: string;
  orderCount: number;
  totalOrderValue: string;
}

interface SalesChannelsProps {
  channels: SalesChannel[];
  formatCurrency: (amount: string, currencyCode: string) => string;
}

export function SalesChannels({
  channels,
  formatCurrency,
}: SalesChannelsProps) {
  const groupedChannels = channels.reduce((groups, channel) => {
    const existing = groups.get(channel.currencyCode) ?? [];
    existing.push(channel);
    groups.set(channel.currencyCode, existing);
    return groups;
  }, new Map<string, SalesChannel[]>());

  return (
    <section className="rounded-xl border border-border bg-white p-5 shadow-sm shadow-slate-100/70 sm:p-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Sales by channel
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Revenue distribution by sales channel
        </p>
      </div>

      {channels.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">
          No sales channel data is available for this reporting period.
        </p>
      ) : (
        <div className="mt-6 space-y-7">
          {Array.from(groupedChannels.entries()).map(
            ([currencyCode, currencyChannels]) => {
              const totalValue = currencyChannels.reduce((total, channel) => {
                const value = Number(channel.totalOrderValue);
                return (
                  total + (Number.isFinite(value) ? Math.max(value, 0) : 0)
                );
              }, 0);

              return (
                <div key={currencyCode}>
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {currencyCode}
                  </h3>

                  <div className="space-y-5">
                    {currencyChannels.map((channel) => {
                      const parsedValue = Number(channel.totalOrderValue);
                      const safeValue = Number.isFinite(parsedValue)
                        ? Math.max(parsedValue, 0)
                        : 0;

                      const percentage =
                        totalValue > 0 ? (safeValue / totalValue) * 100 : 0;

                      return (
                        <div key={`${currencyCode}-${channel.channel}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-medium text-slate-700">
                                {channel.channel}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-400">
                                {channel.orderCount.toLocaleString("en-IN")}{" "}
                                {channel.orderCount === 1 ? "order" : "orders"}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-xs font-semibold text-slate-800">
                                {formatCurrency(
                                  channel.totalOrderValue,
                                  currencyCode,
                                )}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-400">
                                {percentage.toFixed(1)}% of channel revenue
                              </p>
                            </div>
                          </div>

                          <div
                            className="mt-2 h-2 overflow-hidden rounded-full bg-[#F1ECFA]"
                            role="progressbar"
                            aria-label={`${channel.channel} share of ${currencyCode} revenue`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Number(percentage.toFixed(1))}
                          >
                            <div
                              className="h-full rounded-full bg-[#7955C8] transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}
