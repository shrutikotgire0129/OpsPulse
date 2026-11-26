import { ArrowRight } from "lucide-react";
import { orders } from "@/lib/dashboard-data";

export function RecentOrders() {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm shadow-slate-100/70">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Recent orders
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Latest transactions from your store
          </p>
        </div>

        <a
          href="#orders"
          className="flex items-center gap-1 text-xs font-semibold text-[#7955C8] hover:text-[#6247AA]"
        >
          View all <ArrowRight size={14} />
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead>
            <tr className="bg-slate-50/80 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-6 py-3">Order</th>
              <th className="px-6 py-3">Customer</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr
                key={order.id}
                className="transition-colors hover:bg-slate-50/70"
              >
                <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                  {order.id}
                </td>

                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                      {order.initials}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        {order.customer}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {order.email}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4 text-xs text-slate-500">
                  {order.date}
                </td>

                <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                  {order.amount}
                </td>

                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${order.statusStyle}`}
                  >
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
