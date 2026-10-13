import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAdmin } from "@/lib/admin-store";

export const Route = createFileRoute("/_admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { authed, authReady } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (authReady && !authed) {
      navigate({ to: "/", replace: true });
    }
  }, [authReady, authed, navigate]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">Verifying session…</p>
        </div>
      </div>
    );
  }

  if (!authed) return null;

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
