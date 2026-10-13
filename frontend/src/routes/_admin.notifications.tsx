import { Link, createFileRoute } from "@tanstack/react-router";
import { Bell, BellRing, CheckCheck, Tags, UserPlus, Wrench } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, Panel, StatCard } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import {
  customersApi,
  formatDateTime,
  formatNumber,
  notificationsApi,
  DEFAULT_GROUP_ID,
} from "@/services/adminService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_admin/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — FuelPoint Admin" },
      {
        name: "description",
        content: "Admin notification centre: new customer registrations, worker logins and alerts.",
      },
      { property: "og:title", content: "Notifications — FuelPoint Admin" },
      {
        property: "og:description",
        content: "Registrations awaiting group assignment, worker alerts and system updates.",
      },
    ],
  }),
  component: NotificationsPage,
});

const icons = {
  registration: UserPlus,
  group: Tags,
  worker: Wrench,
  system: Bell,
} as const;

const filters = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "registration", label: "Registrations" },
  { key: "worker", label: "Workers" },
  { key: "system", label: "System" },
] as const;

function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const queryType =
    filter === "registration" || filter === "worker"
      ? (filter as "registration" | "worker")
      : undefined;
  const unreadOnly = filter === "unread" ? true : undefined;

  const notificationsQuery = useQuery({
    queryKey: ["admin", "notifications", { type: queryType, unreadOnly }],
    queryFn: () =>
      notificationsApi.list({
        type: queryType,
        unreadOnly,
        limit: 50,
      }),
  });

  const pendingGroupQuery = useQuery({
    queryKey: ["admin", "customers", "pending-group-count"],
    queryFn: () => customersApi.list({ group_id: DEFAULT_GROUP_ID, limit: 1 }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
      toast.success("Notification marked as read");
    },
    onError: (err: Error) => {
      toast.error("Failed to mark as read", { description: err.message });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
      toast.success("All notifications marked as read");
    },
    onError: (err: Error) => {
      toast.error("Failed to mark all as read", { description: err.message });
    },
  });

  const notifications = notificationsQuery.data?.notifications ?? [];
  const totalCount = notificationsQuery.data?.pagination.total ?? notifications.length;
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const pendingGroupCount = pendingGroupQuery.data?.pagination.total ?? 0;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Everything that needs an admin decision, in one place."
        actions={
          <Button
            variant="outline"
            disabled={markAllReadMutation.isPending || unreadCount === 0}
            onClick={() => markAllReadMutation.mutate()}
          >
            <CheckCheck className="size-4" />
            {markAllReadMutation.isPending ? "Marking…" : "Mark all read"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total notifications" value={formatNumber(totalCount)} icon={Bell} />
        <StatCard label="Unread" value={formatNumber(unreadCount)} icon={BellRing} tone="warning" />
        <StatCard
          label="Registrations pending group"
          value={formatNumber(pendingGroupCount)}
          icon={UserPlus}
          tone="teal"
          to="/customers"
        />
      </div>

      <Panel title="Notification centre" description="Newest first" className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={
                filter === f.key
                  ? "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <ul className="divide-y divide-border">
          {notifications.map((n) => {
            const Icon = icons[n.type] ?? Bell;
            return (
              <li
                key={n.id}
                className={cn(
                  "flex flex-wrap items-start gap-3 px-1 py-4 transition-colors",
                  !n.read && "bg-accent/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    n.read ? "bg-muted text-muted-foreground" : "bg-primary/12 text-primary",
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-56 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    {!n.read && <span className="size-2 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(n.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {n.customerId && (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/customers">Open customer</Link>
                    </Button>
                  )}
                  {n.workerId && (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/workers">Open worker</Link>
                    </Button>
                  )}
                  {!n.read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={markReadMutation.isPending}
                      onClick={() => markReadMutation.mutate(n.id)}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
          {notifications.length === 0 && (
            <li className="py-12 text-center text-sm text-muted-foreground">
              {notificationsQuery.isLoading
                ? "Loading notifications…"
                : "Nothing here — you're all caught up."}
            </li>
          )}
        </ul>
      </Panel>
    </>
  );
}
