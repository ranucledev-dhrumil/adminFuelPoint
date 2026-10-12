import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BadgePercent,
  CalendarClock,
  Tags,
  TrendingUp,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  DonutChart,
  HorizontalBarChart,
  TrendAreaChart,
} from "@/components/admin/charts";
import { PageHeader, Panel, StatCard } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/lib/admin-store";
import {
  adminService,
  buildOverview,
  buildSeries,
  formatCurrency,
  formatDateTime,
  formatNumber,
  groupDistribution,
  workerActivity,
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
  const { customers, workers, groups, transactions } = useAdmin();
  const [days, setDays] = useState<number>(30);

  const overview = useMemo(() => {
    const cutoff = adminService.getToday().getTime() - days * 86400000;
    const periodCustomers = customers.filter(c => new Date(c.registeredAt).getTime() >= cutoff);
    const periodTransactions = transactions.filter(t => new Date(t.createdAt).getTime() >= cutoff);
    return buildOverview(periodCustomers, workers, groups, periodTransactions);
  }, [customers, workers, groups, transactions, days]);
  const series = useMemo(
    () => buildSeries(customers, transactions, days),
    [customers, transactions, days],
  );
  const dist = useMemo(
    () => groupDistribution(customers, groups, transactions).filter((g) => g.customers > 0),
    [customers, groups, transactions],
  );
  const activity = useMemo(() => workerActivity(workers).slice(0, 8), [workers]);
  const recent = transactions.slice(0, 8);

  const half = Math.floor(series.length / 2);
  const delta = (key: "transactions" | "discount" | "registrations") => {
    const first = series.slice(0, half).reduce((s, p) => s + p[key], 0);
    const second = series.slice(half).reduce((s, p) => s + p[key], 0);
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
          hint={`avg ${overview.avgDiscountPercent.toFixed(2)}% of sales`}
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
                {groups.length} groups
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
          <Panel
            title="Worker scanning activity"
            description="Top performers by scans"
          >
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
            <ul className="divide-y divide-border/70">
              {recent.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 py-3 px-1 transition-colors hover:bg-muted/30 first:pt-1 last:pb-1"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                    {t.customerName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.customerName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.fuel} · {t.litres} L · scanned by {t.workerName}
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
                    {formatDateTime(t.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
