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

  if (!authReady || !authed) return null;

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
