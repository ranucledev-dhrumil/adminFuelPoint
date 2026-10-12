import { Link, createFileRoute } from "@tanstack/react-router";
import { Bell, BellRing, CheckCheck, Tags, UserPlus, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel, StatCard } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/lib/admin-store";
import { formatDateTime, formatNumber, DEFAULT_GROUP_ID } from "@/services/adminService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_admin/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — FuelPoint Admin" },
      {
        name: "description",
        content:
          "Admin notification centre: new customer registrations awaiting group assignment and system alerts.",
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
  { key: "system", label: "System" },
] as const;

function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead, customers } = useAdmin();
  const [filter, setFilter] = useState<string>("all");

  const list = notifications.filter((n) =>
    filter === "all" ? true : filter === "unread" ? !n.read : n.type === filter,
  );

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Everything that needs an admin decision, in one place."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              markAllRead();
              toast.success("All notifications marked as read");
            }}
          >
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total notifications" value={formatNumber(notifications.length)} icon={Bell} />
        <StatCard label="Unread" value={formatNumber(unreadCount)} icon={BellRing} tone="warning" />
        <StatCard
          label="Registrations pending group"
          value={formatNumber(customers.filter((c) => c.groupId === DEFAULT_GROUP_ID).length)}
          icon={UserPlus}
          tone="teal"
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
          {list.map((n) => {
            const Icon = icons[n.type];
            return (
              <li
                key={n.id}
                className={cn(
                  "flex flex-wrap items-start gap-3 px-1 py-4",
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
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {n.customerId && (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/customers">Open customer</Link>
                    </Button>
                  )}
                  {!n.read && (
                    <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
          {list.length === 0 && (
            <li className="py-12 text-center text-sm text-muted-foreground">
              Nothing here — you're all caught up.
            </li>
          )}
        </ul>
      </Panel>
    </>
  );
}
