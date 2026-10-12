import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Column, DataTable, TablePagination } from "@/components/admin/DataTable";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdmin } from "@/lib/admin-store";
import {
  buildSeries,
  exportCsv,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  groupDistribution,
  inRange,
  rangeBounds,
  DEFAULT_GROUP_ID,
  type RangeKey,
} from "@/services/adminService";

export const Route = createFileRoute("/_admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports — FuelPoint Admin" },
      {
        name: "description",
        content:
          "Customer, worker, transaction, discount and group reports with date ranges and CSV export.",
      },
      { property: "og:title", content: "Reports — FuelPoint Admin" },
      {
        property: "og:description",
        content: "Date-ranged petrol pump reports with summary metrics and CSV export.",
      },
    ],
  }),
  component: ReportsPage,
});

const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "quarter", label: "90 days" },
  { key: "custom", label: "Custom" },
];

const categories = [
  { key: "transactions", label: "Transactions" },
  { key: "discount", label: "Discount" },
  { key: "customers", label: "Customers" },
  { key: "workers", label: "Workers" },
  { key: "groups", label: "Groups" },
] as const;

type Category = (typeof categories)[number]["key"];

function ReportsPage() {
  const { customers, workers, groups, transactions } = useAdmin();
  const [range, setRange] = useState<RangeKey>("month");
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState("2026-09-23");
  const [category, setCategory] = useState<Category>("transactions");

  const bounds = useMemo(() => rangeBounds(range, from, to), [range, from, to]);
  const txns = useMemo(
    () => transactions.filter((t) => inRange(t.createdAt, bounds)),
    [transactions, bounds],
  );
  const regs = useMemo(
    () => customers.filter((c) => inRange(c.registeredAt, bounds)),
    [customers, bounds],
  );
  const days = Math.max(
    1,
    Math.round((bounds.end.getTime() - bounds.start.getTime()) / 86400000) + 1,
  );
  const series = useMemo(
    () => buildSeries(customers, txns, Math.min(days, 90)),
    [customers, txns, days],
  );
  const dist = useMemo(() => groupDistribution(customers, groups, txns), [customers, groups, txns]);

  const discountTotal = txns.reduce((s, t) => s + t.discountAmount, 0);
  const revenueTotal = txns.reduce((s, t) => s + t.amount, 0);
  const litresTotal = Math.round(txns.reduce((s, t) => s + t.litres, 0));

  const summary: [string, string][] = {
    transactions: [
      ["Transactions", formatNumber(txns.length)],
      ["Revenue", formatCurrency(revenueTotal)],
      ["Litres dispensed", formatNumber(litresTotal)],
      ["Avg ticket", formatCurrency(txns.length ? revenueTotal / txns.length : 0)],
    ],
    discount: [
      ["Discount given", formatCurrency(discountTotal)],
      [
        "Effective rate",
        `${revenueTotal ? ((discountTotal / revenueTotal) * 100).toFixed(2) : "0"}%`,
      ],
      ["Discounted scans", formatNumber(txns.filter((t) => t.discountAmount > 0).length)],
      ["Avg discount/scan", formatCurrency(txns.length ? discountTotal / txns.length : 0)],
    ],
    customers: [
      ["New registrations", formatNumber(regs.length)],
      ["Total customers", formatNumber(customers.length)],
      ["Active", formatNumber(customers.filter((c) => c.status === "active").length)],
      ["Unassigned", formatNumber(customers.filter((c) => c.groupId === DEFAULT_GROUP_ID).length)],
    ],
    workers: [
      ["Workers", formatNumber(workers.length)],
      ["Active", formatNumber(workers.filter((w) => w.status === "active").length)],
      ["Scans in range", formatNumber(txns.length)],
      ["Discount processed", formatCurrency(discountTotal)],
    ],
    groups: [
      ["Groups", formatNumber(groups.length)],
      ["Active groups", formatNumber(groups.filter((g) => g.active).length)],
      ["Group discount", formatCurrency(discountTotal)],
      [
        "Grouped customers",
        formatNumber(customers.filter((c) => c.groupId !== DEFAULT_GROUP_ID).length),
      ],
    ],
  }[category] as [string, string][];

  const exportRows = () => {
    if (category === "customers")
      return regs.map((c) => ({
        ID: c.id,
        Name: c.name,
        Phone: c.phone,
        Group: groups.find((g) => g.id === c.groupId)?.name ?? "",
        Registered: formatDate(c.registeredAt),
        Transactions: c.transactions,
        Discount: c.discountReceived,
      }));
    if (category === "workers")
      return workers.map((w) => ({
        ID: w.id,
        Name: w.name,
        Status: w.status,
        Scans: w.scans,
        Transactions: w.transactions,
        DiscountProcessed: w.discountProcessed,
        LastActivity: formatDate(w.lastActivity),
      }));
    if (category === "groups")
      return dist.map((g) => ({
        Group: g.name,
        DiscountPercent: g.discountPercent,
        Customers: g.customers,
        Transactions: g.transactions,
        DiscountGenerated: g.discountGenerated,
      }));
    return txns.map((t) => ({
      ID: t.id,
      Date: formatDateTime(t.createdAt),
      Customer: t.customerName,
      Worker: t.workerName,
      Fuel: t.fuel,
      Litres: t.litres,
      Amount: t.amount,
      DiscountPercent: t.discountPercent,
      Discount: t.discountAmount,
    }));
  };

  const handleExport = (kind: "csv" | "excel") => {
    const rows = exportRows();
    if (!rows.length) {
      toast.error("Nothing to export for this range.");
      return;
    }
    exportCsv(`${category}-report.${kind === "csv" ? "csv" : "xls.csv"}`, rows);
    toast.success(`${kind === "csv" ? "CSV" : "Excel-ready"} report exported`, {
      description: `${rows.length} rows · ${formatDate(bounds.start.toISOString())} → ${formatDate(bounds.end.toISOString())}`,
    });
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Date-ranged reporting across customers, workers, scans, discounts and groups."
      />

      <Tabs value={category} onValueChange={(v) => setCategory(v as Category)}>
        <TabsList>
          {categories.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map(([l, v]) => (
          <StatCard key={l} label={l} value={v} />
        ))}
      </div>

      <Panel
        title={`${categories.find((c) => c.key === category)!.label} report`}
        description="Tabular detail for the selected range"
        className="mt-6"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
              <Download className="size-4" /> Export CSV
            </Button>
            <Button size="sm" onClick={() => handleExport("excel")}>
              <FileSpreadsheet className="size-4" /> Export Excel
            </Button>
          </div>
        }
      >
        <div className="mb-6 flex flex-wrap items-end gap-3 border-b border-border/40 pb-5">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-background p-1">
            {rangeOptions.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={
                  range === r.key
                    ? "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm"
                    : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                }
              >
                {r.label}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="from" className="text-xs">
                  From
                </Label>
                <Input
                  id="from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="to" className="text-xs">
                  To
                </Label>
                <Input
                  id="to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          )}
          <p className="ml-auto text-xs text-muted-foreground">
            {formatDate(bounds.start.toISOString())} → {formatDate(bounds.end.toISOString())} ·{" "}
            {formatNumber(txns.length)} scans in range
          </p>
        </div>

        <div className="mt-4">
          {category === "workers" && (
            <DataTable 
              rows={workers} 
              pageSize={10}
              emptyMessage="No workers found."
              columns={[
                { key: "name", header: "Worker", sortValue: w => w.name, render: w => <span className="font-medium">{w.name}</span> },
                { key: "status", header: "Status", sortValue: w => w.status, render: w => <StatusBadge status={w.status} /> },
                { key: "scans", header: "Scans", sortValue: w => w.scans, render: w => formatNumber(w.scans) },
                { key: "transactions", header: "Transactions", sortValue: w => w.transactions, render: w => formatNumber(w.transactions) },
                { key: "discount", header: "Discount processed", sortValue: w => w.discountProcessed, render: w => <span className="font-medium text-teal">{formatCurrency(w.discountProcessed)}</span> },
                { key: "lastActivity", header: "Last activity", sortValue: w => w.lastActivity, render: w => <span className="text-muted-foreground">{formatDate(w.lastActivity)}</span> },
              ]} 
            />
          )}

          {category === "groups" && (
            <DataTable 
              rows={dist} 
              pageSize={10}
              emptyMessage="No groups found."
              columns={[
                { key: "name", header: "Group", sortValue: g => g.name, render: g => <span className="font-medium">{g.name}</span> },
                { key: "discount", header: "Discount %", sortValue: g => g.discountPercent, render: g => `${g.discountPercent}%` },
                { key: "customers", header: "Customers", sortValue: g => g.customers, render: g => formatNumber(g.customers) },
                { key: "transactions", header: "Transactions", sortValue: g => g.transactions, render: g => formatNumber(g.transactions) },
                { key: "discountGenerated", header: "Discount generated", sortValue: g => g.discountGenerated, render: g => <span className="font-medium text-teal">{formatCurrency(g.discountGenerated)}</span> },
              ]}
            />
          )}

          {category === "customers" && (
            <DataTable 
              rows={regs} 
              pageSize={10}
              emptyMessage="No registrations in this range."
              columns={[
                { key: "name", header: "Customer", sortValue: c => c.name, render: c => <span className="font-medium">{c.name}</span> },
                { key: "registered", header: "Registered", sortValue: c => c.registeredAt, render: c => <span className="text-muted-foreground">{formatDate(c.registeredAt)}</span> },
                { key: "group", header: "Group", sortValue: c => groups.find((g) => g.id === c.groupId)?.name ?? "", render: c => groups.find((g) => g.id === c.groupId)?.name },
                { key: "transactions", header: "Transactions", sortValue: c => c.transactions, render: c => formatNumber(c.transactions) },
                { key: "discount", header: "Discount received", sortValue: c => c.discountReceived, render: c => <span className="font-medium text-teal">{formatCurrency(c.discountReceived)}</span> },
                { key: "status", header: "Status", sortValue: c => c.status, render: c => <StatusBadge status={c.status} /> },
              ]}
            />
          )}

          {(category === "transactions" || category === "discount") && (
            <DataTable 
              rows={txns} 
              pageSize={10}
              emptyMessage="No transactions in this range."
              columns={[
                { key: "id", header: "Txn", sortValue: t => t.id, render: t => <span className="font-mono text-xs text-muted-foreground">{t.id}</span> },
                { key: "date", header: "Date", sortValue: t => t.createdAt, render: t => <span className="text-muted-foreground">{formatDateTime(t.createdAt)}</span> },
                { key: "customer", header: "Customer", sortValue: t => t.customerName, render: t => <span className="font-medium">{t.customerName}</span> },
                { key: "worker", header: "Worker", sortValue: t => t.workerName, render: t => t.workerName },
                { key: "fuel", header: "Fuel", sortValue: t => t.litres, render: t => <span className="text-muted-foreground">{t.fuel} • {t.litres} L</span> },
                { key: "amount", header: "Amount", sortValue: t => t.amount, render: t => <span className="font-medium">{formatCurrency(t.amount)}</span> },
                { key: "discount", header: "Discount", sortValue: t => t.discountAmount, render: t => <span className="font-medium text-teal">-{formatCurrency(t.discountAmount)} ({t.discountPercent}%)</span> },
              ]}
            />
          )}
        </div>
      </Panel>
    </>
  );
}
