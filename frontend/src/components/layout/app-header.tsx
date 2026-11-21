import { Bell, Menu, Search } from "lucide-react";

interface AppHeaderProps {
  onMenuClick: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border bg-white/95 px-5 backdrop-blur-md sm:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation menu"
          aria-controls="mobile-navigation"
          onClick={onMenuClick}
          className="flex size-9 items-center justify-center rounded-lg border border-border text-slate-600 hover:bg-slate-50 lg:hidden"
        >
          <Menu size={18} />
        </button>

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
