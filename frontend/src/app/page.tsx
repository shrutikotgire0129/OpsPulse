import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

const navigation = [
  {
    label: "OVERVIEW",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, active: true },
      { name: "Analytics", icon: Activity },
    ],
  },
  {
    label: "COMMERCE",
    items: [
      { name: "Orders", icon: ShoppingCart },
      { name: "Products", icon: Package },
      { name: "Inventory", icon: Boxes },
      { name: "Customers", icon: Users },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { name: "Payments", icon: CreditCard },
      { name: "Reports", icon: Wallet },
      { name: "Settings", icon: Settings },
    ],
  },
];

const metrics = [
  {
    title: "Total Revenue",
    value: "$48,294.00",
    change: "+12.8%",
    description: "vs. previous month",
    icon: Wallet,
    positive: true,
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "Total Orders",
    value: "1,284",
    change: "+8.2%",
    description: "vs. previous month",
    icon: ShoppingCart,
    positive: true,
    color: "bg-violet-50 text-violet-600",
  },
  {
    title: "Total Customers",
    value: "8,549",
    change: "+5.4%",
    description: "vs. previous month",
    icon: Users,
    positive: true,
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "Average Order Value",
    value: "$37.61",
    change: "-2.1%",
    description: "vs. previous month",
    icon: CreditCard,
    positive: false,
    color: "bg-amber-50 text-amber-600",
  },
];

const revenue = [
  { month: "Jan", current: 38, previous: 27 },
  { month: "Feb", current: 52, previous: 34 },
  { month: "Mar", current: 43, previous: 38 },
  { month: "Apr", current: 68, previous: 43 },
  { month: "May", current: 57, previous: 39 },
  { month: "Jun", current: 79, previous: 51 },
  { month: "Jul", current: 64, previous: 45 },
  { month: "Aug", current: 88, previous: 58 },
  { month: "Sep", current: 72, previous: 53 },
  { month: "Oct", current: 96, previous: 65 },
  { month: "Nov", current: 82, previous: 59 },
  { month: "Dec", current: 100, previous: 71 },
];

const channels = [
  {
    name: "Online Store",
    percentage: 58,
    amount: "$28,010",
    color: "bg-blue-600",
  },
  {
    name: "Marketplace",
    percentage: 27,
    amount: "$13,039",
    color: "bg-violet-500",
  },
  {
    name: "Retail Store",
    percentage: 15,
    amount: "$7,245",
    color: "bg-emerald-500",
  },
];

const orders = [
  {
    id: "#ORD-7291",
    customer: "Olivia Rhye",
    initials: "OR",
    email: "olivia@example.com",
    date: "Nov 21, 2026",
    amount: "$249.00",
    status: "Completed",
    statusStyle: "bg-emerald-50 text-emerald-700",
  },
  {
    id: "#ORD-7290",
    customer: "Phoenix Baker",
    initials: "PB",
    email: "phoenix@example.com",
    date: "Nov 21, 2026",
    amount: "$125.50",
    status: "Processing",
    statusStyle: "bg-blue-50 text-blue-700",
  },
  {
    id: "#ORD-7289",
    customer: "Lana Steiner",
    initials: "LS",
    email: "lana@example.com",
    date: "Nov 20, 2026",
    amount: "$89.00",
    status: "Completed",
    statusStyle: "bg-emerald-50 text-emerald-700",
  },
  {
    id: "#ORD-7288",
    customer: "Demi Wilkinson",
    initials: "DW",
    email: "demi@example.com",
    date: "Nov 20, 2026",
    amount: "$420.00",
    status: "Pending",
    statusStyle: "bg-amber-50 text-amber-700",
  },
  {
    id: "#ORD-7287",
    customer: "Candice Wu",
    initials: "CW",
    email: "candice@example.com",
    date: "Nov 19, 2026",
    amount: "$175.00",
    status: "Completed",
    statusStyle: "bg-emerald-50 text-emerald-700",
  },
];

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-white lg:flex">
      <div className="flex h-[72px] items-center gap-3 border-b border-border px-6">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-white">
          <Zap size={21} fill="currentColor" />
        </div>
        <div>
          <p className="text-[17px] font-bold tracking-tight text-slate-900">
            OpsPulse
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
            Business intelligence
          </p>
        </div>
      </div>

      <div className="border-b border-border p-4">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-slate-50"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-700">
            AC
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">
              Acme Commerce
            </p>
            <p className="text-xs text-slate-500">Business workspace</p>
          </div>
          <ChevronDown size={15} className="text-slate-400" />
        </button>
      </div>

      <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
        {navigation.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.13em] text-slate-400">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.name}
                    href={item.active ? "/" : "#"}
                    aria-current={item.active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                      item.active
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    {item.name}
                    {item.name === "Orders" && (
                      <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        12
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="space-y-1">
          <a
            href="#help"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50"
          >
            <CircleHelp size={17} />
            Help center
          </a>
          <a
            href="#support"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50"
          >
            <LifeBuoy size={17} />
            Support
          </a>
        </div>
        <div className="mt-3 flex items-center gap-3 border-t border-border px-2 pt-4">
          <div className="flex size-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
            SK
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-800">
              Workspace Admin
            </p>
            <p className="truncate text-[11px] text-slate-400">
              admin@acme.com
            </p>
          </div>
          <Settings size={16} className="text-slate-400" />
        </div>
      </div>
    </aside>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border bg-white/95 px-5 backdrop-blur-md sm:px-8">
      <div className="flex items-center gap-3">
        <div className="hidden text-sm text-slate-400 sm:block">
          Workspace <span className="mx-2">/</span>
        </div>
        <span className="text-sm font-semibold text-slate-800">Dashboard</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden h-9 w-[230px] items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 md:flex">
          <Search size={15} className="text-slate-400" />
          <span className="text-xs text-slate-400">Search anything...</span>
          <span className="ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400">
            Ctrl K
          </span>
        </div>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-slate-50"
        >
          <Bell size={17} />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500" />
        </button>
        <div className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
          SK
        </div>
      </div>
    </header>
  );
}

function MetricCard({ metric }: { metric: (typeof metrics)[number] }) {
  const Icon = metric.icon;
  const TrendIcon = metric.positive ? ArrowUpRight : ArrowDownRight;

  return (
    <article className="rounded-xl border border-border bg-white p-5 shadow-sm shadow-slate-100/70">
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-slate-500">{metric.title}</p>
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

function RevenueChart() {
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

function SalesChannels() {
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

function RecentOrders() {
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
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
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

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <div className="min-h-screen lg:pl-[248px]">
        <Header />

        <main className="mx-auto max-w-[1600px] space-y-7 px-5 py-7 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[23px] font-bold tracking-tight text-slate-900">
                  Good morning, Admin
                </h1>
                <span className="text-xl">👋</span>
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
      </div>
    </div>
  );
}
