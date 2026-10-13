import { Link, createFileRoute } from "@tanstack/react-router";
import { BadgePercent, CalendarClock, Users, Wrench } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DonutChart, HorizontalBarChart, TrendAreaChart } from "@/components/admin/charts";
import { PageHeader, Panel, StatCard } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import {
  dashboardApi,
  formatCurrency,
  formatDateTime,
  formatNumber,
  transactionsApi,
} from "@/services/adminService";

export const Route = createFileRoute("/_admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FuelPoint Admin" },
      {
        name: "description",
        content: "Live analytics for scans, discounts, customer registrations and worker activity.",
      },
      { property: "og:title", content: "Dashboard — FuelPoint Admin" },
      {
        property: "og:description",
        content: "Live petrol pump analytics: scans, discounts, registrations and workers.",
      },
    ],
  }),
  component: DashboardPage,
});

const ranges = [
  { key: 7, label: "7 days" },
  { key: 30, label: "30 days" },
  { key: 90, label: "90 days" },
] as const;

function DashboardPage() {
  const [days, setDays] = useState<number>(30);

  const overviewQuery = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: () => dashboardApi.getOverview(),
  });

  const seriesQuery = useQuery({
    queryKey: ["dashboard", "series", days],
    queryFn: () => dashboardApi.getSeries(days),
  });

  const groupsQuery = useQuery({
    queryKey: ["dashboard", "groups"],
    queryFn: () => dashboardApi.getGroupDistribution(),
  });

  const workersQuery = useQuery({
    queryKey: ["dashboard", "workers"],
    queryFn: () => dashboardApi.getWorkerActivity(),
  });

  const recentQuery = useQuery({
    queryKey: ["dashboard", "recent-transactions"],
    queryFn: () => transactionsApi.list({ limit: 8, sort_by: "submitted_at", order: "desc" }),
  });

  const overview = overviewQuery.data ?? {
    totalCustomers: 0,
    totalWorkers: 0,
    activeWorkers: 0,
    totalGroups: 0,
    totalTransactions: 0,
    totalDiscount: 0,
    totalRevenue: 0,
    todayTransactions: 0,
    todayDiscount: 0,
    newRegistrations7d: 0,
    activeCustomers: 0,
    usedPumpCustomers: 0,
    unassignedCustomers: 0,
    avgDiscountPercent: 0,
  };

  const series = seriesQuery.data ?? [];
  const dist = (groupsQuery.data ?? []).filter((g) => g.customers > 0);
  const activity = (workersQuery.data ?? []).slice(0, 8).map((w) => ({
    name: w.name.split(" ")[0] || w.name,
    scans: w.scans,
    transactions: w.transactions,
  }));
  const recent = recentQuery.data?.data ?? [];

  const half = Math.floor(series.length / 2);
  const delta = (key: "transactions" | "discount" | "registrations") => {
    const first = series.slice(0, half).reduce((s, p) => s + Number(p[key] || 0), 0);
    const second = series.slice(half).reduce((s, p) => s + Number(p[key] || 0), 0);
    if (!first) return 0;
    return ((second - first) / first) * 100;
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Performance of scans, discounts and customer growth across your pump network."
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {ranges.map((r) => (
              <button
                key={r.key}
                onClick={() => setDays(r.key)}
                className={
                  days === r.key
                    ? "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total customers"
          value={formatNumber(overview.totalCustomers)}
          icon={Users}
          delta={delta("registrations")}
          hint="in this period"
          to="/customers"
        />
        <StatCard
          label="Total workers"
          value={formatNumber(overview.totalWorkers)}
          icon={Wrench}
          tone="teal"
          hint={`${overview.activeWorkers} active now`}
          to="/workers"
        />
        <StatCard
          label="Total discount given"
          value={formatCurrency(overview.totalDiscount)}
          icon={BadgePercent}
          tone="teal"
          delta={delta("discount")}
          hint={`avg ${Number(overview.avgDiscountPercent).toFixed(2)}% of sales`}
          to="/reports"
        />
        <StatCard
          label="Today's transactions"
          value={formatNumber(overview.todayTransactions)}
          icon={CalendarClock}
          hint={`${formatCurrency(overview.todayDiscount)} discount today`}
          to="/reports"
        />
      </div>

      <div className="mt-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel
            title="Transactions & scans over time"
            description={`Daily scan volume for the last ${days} days`}
            className="lg:col-span-2"
          >
            <TrendAreaChart data={series} dataKey="transactions" height={280} />
          </Panel>
          <Panel
            title="Group-wise customers"
            description="Distribution across discount groups"
            actions={
              <div className="flex h-6 items-center rounded bg-muted px-2 text-xs font-semibold text-muted-foreground">
                {(groupsQuery.data ?? []).length} groups
              </div>
            }
          >
            <DonutChart
              data={dist.map((g) => ({ name: g.name, value: g.customers }))}
              height={280}
            />
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Discount given over time" description="Rupees discounted per day">
            <TrendAreaChart
              data={series}
              dataKey="discount"
              color="var(--teal)"
              height={280}
              valueFormatter={formatCurrency}
            />
          </Panel>
          <Panel title="Worker scanning activity" description="Top performers by scans">
            <HorizontalBarChart
              data={activity}
              dataKey="scans"
              height={280}
              color="var(--primary)"
            />
          </Panel>
        </div>

        <div className="grid gap-6">
          <Panel
            title="Recent transactions"
            description="Latest scans processed at the pump"
            actions={
              <Button asChild variant="outline" size="sm">
                <Link to="/reports">View reports</Link>
              </Button>
            }
          >
            {recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No recent transactions found.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {recent.map((t) => {
                  const fuelLabel = t.fuel ?? "—";
                  const litresLabel =
                    t.litres !== undefined && t.litres !== null ? `${t.litres} L` : "—";
                  const initials = (t.customerName || "CU")
                    .split(" ")
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2);

                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 py-3 px-1 transition-colors hover:bg-muted/30 first:pt-1 last:pb-1"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                        {initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {t.customerName || "Customer"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {fuelLabel} · {litresLabel} · scanned by {t.workerName || "Attendant"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(t.amount)}
                        </p>
                        <p className="text-xs font-medium text-teal">
                          −{formatCurrency(t.discountAmount)} ({t.discountPercent}%)
                        </p>
                      </div>
                      <p className="hidden w-28 text-right text-xs text-muted-foreground sm:block">
                        {formatDateTime(t.submittedAt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
