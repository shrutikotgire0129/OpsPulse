"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { useAuth } from "@/lib/auth-context";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  const { status, selectedOrganization, refreshSession } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-slate-500">
          {status === "loading"
            ? "Restoring your session..."
            : "Redirecting to sign in..."}
        </p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <section className="w-full max-w-md rounded-xl border border-border bg-white p-7 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            Unable to connect
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            We couldn&apos;t verify your session. Check that the OpsPulse server is
            running and try again.
          </p>
          <button
            type="button"
            onClick={() => void refreshSession()}
            className="mt-5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Retry connection
          </button>
        </section>
      </main>
    );
  }

  if (!selectedOrganization) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <section className="w-full max-w-md rounded-xl border border-border bg-white p-7 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            No organization available
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Your account doesn&apos;t currently have an active organization. Contact
            your organization administrator for access.
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="min-h-screen lg:pl-[248px]">
        <AppHeader onMenuClick={() => setMobileOpen(true)} />
        {children}
      </div>
    </div>
  );
}
