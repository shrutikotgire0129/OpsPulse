import {
  ChevronDown,
  CircleHelp,
  LifeBuoy,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { navigation } from "@/lib/dashboard-data";

interface AppSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-border px-6">
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

      <div className="shrink-0 border-b border-border p-4">
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
                    onClick={onNavigate}
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

      <div className="shrink-0 border-t border-border p-3">
        <div className="space-y-1">
          <a
            href="#help"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50"
          >
            <CircleHelp size={17} />
            Help center
          </a>

          <a
            href="#support"
            onClick={onNavigate}
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
    </>
  );
}

export function AppSidebar({ mobileOpen, onClose }: AppSidebarProps) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-white lg:flex">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/40"
          />

          <aside
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col border-r border-border bg-white shadow-xl"
          >
            <div className="absolute right-3 top-5 z-10">
              <button
                type="button"
                aria-label="Close menu"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <SidebarContent onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
