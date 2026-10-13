import { createFileRoute } from "@tanstack/react-router";
import {
  Download,
  FileSpreadsheet,
  History,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/admin/DataTable";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  customersApi,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPhone,
  groupsApi,
  reportsApi,
  transactionsApi,
  workersApi,
  DEFAULT_GROUP_ID,
  type RangeKey,
} from "@/services/adminService";
import type { AdminTransaction, Customer, Group, Worker } from "@/services/types";

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

function computeDateStrings(range: RangeKey, customFrom: string, customTo: string) {
  const now = new Date();
  const formatYmd = (d: Date) => d.toISOString().slice(0, 10);
  const to = formatYmd(now);

  if (range === "today") {
    return { from: to, to };
  }
  if (range === "week") {
    const d = new Date(now.getTime() - 6 * 86400000);
    return { from: formatYmd(d), to };
  }
  if (range === "month") {
    const d = new Date(now.getTime() - 29 * 86400000);
    return { from: formatYmd(d), to };
  }
  if (range === "quarter") {
    const d = new Date(now.getTime() - 89 * 86400000);
    return { from: formatYmd(d), to };
  }
  return { from: customFrom, to: customTo };
}

function ReportsPage() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeKey>("month");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<Category>("transactions");

  // Server-side pagination & sorting for transactions
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(15);
  const [txSortBy, setTxSortBy] = useState<
    "submitted_at" | "amount" | "discount_amount" | "status"
  >("submitted_at");
  const [txSortOrder, setTxSortOrder] = useState<"asc" | "desc">("desc");
  const [txStatusFilter, setTxStatusFilter] = useState<"all" | "pending" | "success" | "failed">(
    "all",
  );

  // Pagination for other tabs
  const [custPage, setCustPage] = useState(1);
  const [workPage, setWorkPage] = useState(1);

  // Transaction detail & status change dialog state
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [targetStatus, setTargetStatus] = useState<"success" | "failed">("success");
  const [failureReason, setFailureReason] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const { from: fromStr, to: toStr } = computeDateStrings(range, customFrom, customTo);

  // Summary Metrics Query
  const summaryQuery = useQuery({
    queryKey: ["admin", "reports", "summary", category, fromStr, toStr],
    queryFn: () => reportsApi.getSummary(category, fromStr, toStr),
  });

  // Transactions Query
  const transactionsQuery = useQuery({
    queryKey: [
      "admin",
      "transactions",
      {
        page: txPage,
        limit: txPageSize,
        sort_by: txSortBy,
        order: txSortOrder,
        from: fromStr,
        to: toStr,
        status: txStatusFilter === "all" ? undefined : txStatusFilter,
      },
    ],
    queryFn: () =>
      transactionsApi.list({
        page: txPage,
        limit: txPageSize,
        sort_by: txSortBy,
        order: txSortOrder,
        from: fromStr,
        to: toStr,
        status: txStatusFilter === "all" ? undefined : txStatusFilter,
      }),
    enabled: category === "transactions" || category === "discount",
  });

  // Selected Transaction Detail Query
  const txDetailQuery = useQuery({
    queryKey: ["admin", "transaction", selectedTxId],
    queryFn: () => transactionsApi.getById(selectedTxId!),
    enabled: Boolean(selectedTxId),
  });

  // Customers Query
  const customersQuery = useQuery({
    queryKey: ["admin", "reports", "customers", custPage],
    queryFn: () => customersApi.list({ page: custPage, limit: 10 }),
    enabled: category === "customers",
  });

  // Workers Query
  const workersQuery = useQuery({
    queryKey: ["admin", "reports", "workers", workPage],
    queryFn: () => workersApi.list({ page: workPage, limit: 10 }),
    enabled: category === "workers",
  });

  // Groups Query
  const groupsQuery = useQuery({
    queryKey: ["admin", "reports", "groups"],
    queryFn: () => groupsApi.list(),
    enabled: category === "groups",
  });

  // Transaction Status Change Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: "success" | "failed";
      reason?: string | null | undefined;
    }) => {
      return transactionsApi.updateStatus(id, status, reason);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "transaction", selectedTxId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Transaction status updated to ${updated.status}`, {
        description: `Txn: ${updated.id.slice(0, 8)}...`,
      });
      setSelectedTxId(null);
      setFailureReason("");
    },
    onError: (err: Error) => {
      toast.error("Failed to update status", { description: err.message });
    },
  });

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      await reportsApi.exportCsv(category, fromStr, toStr);
      toast.success("CSV export downloaded successfully");
    } catch (err) {
      toast.error("Failed to export CSV report", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSortChange = (key: string, dir: "asc" | "desc") => {
    const validSortKeys: Record<string, "submitted_at" | "amount" | "discount_amount" | "status"> =
      {
        submitted_at: "submitted_at",
        date: "submitted_at",
        amount: "amount",
        discount: "discount_amount",
        discount_amount: "discount_amount",
        status: "status",
      };
    const targetKey = validSortKeys[key] || "submitted_at";
    setTxSortBy(targetKey);
    setTxSortOrder(dir);
  };

  const summaryMetrics = summaryQuery.data?.metrics ?? [
    { label: "Transactions", value: 0 },
    { label: "Revenue", value: 0 },
    { label: "Litres dispensed", value: 0 },
    { label: "Avg ticket", value: 0 },
  ];

  const transactionColumns: Column<AdminTransaction>[] = [
    {
      key: "id",
      header: "Txn ID",
      render: (t) => (
        <span className="font-mono text-xs text-muted-foreground">{t.id.slice(0, 8)}…</span>
      ),
    },
    {
      key: "submitted_at",
      header: "Date & Time",
      sortValue: (t) => t.submittedAt,
      render: (t) => (
        <span className="text-muted-foreground text-xs">{formatDateTime(t.submittedAt)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (t) => t.status,
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      key: "customer",
      header: "Customer",
      render: (t) => (
        <div>
          <p className="font-medium text-foreground text-sm">{t.customerName || "Customer"}</p>
          {t.customerPhone && (
            <p className="text-xs text-muted-foreground">{formatPhone(t.customerPhone)}</p>
          )}
        </div>
      ),
    },
    {
      key: "worker",
      header: "Worker",
      render: (t) => <span className="text-sm">{t.workerName || "Attendant"}</span>,
    },
    {
      key: "fuel",
      header: "Fuel & Litres",
      render: (t) => {
        const fuel = t.fuel ?? "—";
        const litres = t.litres !== undefined && t.litres !== null ? `${t.litres} L` : "—";
        return (
          <span className="text-xs text-muted-foreground">
            {fuel} · {litres}
          </span>
        );
      },
    },
    {
      key: "amount",
      header: "Amount",
      sortValue: (t) => t.amount,
      render: (t) => <span className="font-medium">{formatCurrency(t.amount)}</span>,
    },
    {
      key: "discount",
      header: "Discount",
      sortValue: (t) => t.discountAmount,
      render: (t) => (
        <span className="font-medium text-teal text-sm">
          −{formatCurrency(t.discountAmount)} ({t.discountPercent}%)
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (t) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTxId(t.id);
            setTargetStatus(t.status === "success" ? "failed" : "success");
            setFailureReason(t.failureReason || "");
          }}
        >
          Details / Status
        </Button>
      ),
    },
  ];

  const selectedTx = txDetailQuery.data?.transaction;
  const statusHistory = txDetailQuery.data?.statusHistory ?? [];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Date-ranged reporting across customers, workers, scans, discounts and groups."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={isExporting} onClick={handleExportCsv}>
              <Download className="size-4" />
              {isExporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        }
      />

      <Tabs
        value={category}
        onValueChange={(v) => {
          setCategory(v as Category);
          setTxPage(1);
          setCustPage(1);
          setWorkPage(1);
        }}
      >
        <TabsList>
          {categories.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* KPI Stat Cards */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryMetrics.map((m) => {
          let formattedValue = String(m.value);
          if (typeof m.value === "number") {
            formattedValue =
              m.label.toLowerCase().includes("revenue") ||
              m.label.toLowerCase().includes("discount") ||
              m.label.toLowerCase().includes("ticket")
                ? formatCurrency(m.value)
                : formatNumber(m.value);
          }
          return <StatCard key={m.label} label={m.label} value={formattedValue} />;
        })}
      </div>

      <Panel
        title={`${categories.find((c) => c.key === category)!.label} report`}
        description="Tabular detail with server-side filters and status management"
        className="mt-6"
      >
        {/* Filters bar */}
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
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
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
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          )}

          {(category === "transactions" || category === "discount") && (
            <div className="flex items-center gap-2">
              <select
                aria-label="Filter transactions by status"
                value={txStatusFilter}
                onChange={(e) => {
                  setTxStatusFilter(e.target.value as "all" | "pending" | "success" | "failed");
                  setTxPage(1);
                }}
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          )}

          <p className="ml-auto text-xs text-muted-foreground">
            {formatDate(fromStr)} → {formatDate(toStr)}
          </p>
        </div>

        {/* Tab content tables */}
        <div className="mt-4">
          {(category === "transactions" || category === "discount") && (
            <DataTable
              rows={transactionsQuery.data?.data ?? []}
              columns={transactionColumns}
              pageSize={txPageSize}
              isLoading={transactionsQuery.isLoading || transactionsQuery.isFetching}
              emptyMessage="No transactions found for the selected range."
              serverPagination={{
                currentPage: transactionsQuery.data?.pagination.page ?? txPage,
                totalPages: transactionsQuery.data?.pagination.totalPages ?? 1,
                totalItems: transactionsQuery.data?.pagination.total ?? 0,
                pageSize: txPageSize,
                onPageChange: (p) => setTxPage(p),
                onPageSizeChange: (s) => {
                  setTxPageSize(s);
                  setTxPage(1);
                },
                sortKey: txSortBy,
                sortDir: txSortOrder,
                onSortChange: handleSortChange,
              }}
              onRowClick={(t) => {
                setSelectedTxId(t.id);
                setTargetStatus(t.status === "success" ? "failed" : "success");
                setFailureReason(t.failureReason || "");
              }}
            />
          )}

          {category === "workers" && (
            <DataTable
              rows={workersQuery.data?.data ?? []}
              columns={[
                {
                  key: "name",
                  header: "Worker",
                  sortValue: (w: Worker) => w.name,
                  render: (w: Worker) => <span className="font-medium">{w.name}</span>,
                },
                {
                  key: "status",
                  header: "Status",
                  sortValue: (w: Worker) => w.status,
                  render: (w: Worker) => <StatusBadge status={w.status} />,
                },
                {
                  key: "scans",
                  header: "Scans",
                  sortValue: (w: Worker) => w.scans,
                  render: (w: Worker) => formatNumber(w.scans),
                },
                {
                  key: "transactions",
                  header: "Transactions",
                  sortValue: (w: Worker) => w.transactions,
                  render: (w: Worker) => formatNumber(w.transactions),
                },
                {
                  key: "discount",
                  header: "Discount processed",
                  sortValue: (w: Worker) => w.discountProcessed,
                  render: (w: Worker) => (
                    <span className="font-medium text-teal">
                      {formatCurrency(w.discountProcessed)}
                    </span>
                  ),
                },
                {
                  key: "lastActivity",
                  header: "Last activity",
                  sortValue: (w: Worker) => w.lastActivity ?? "",
                  render: (w: Worker) => (
                    <span className="text-muted-foreground">{formatDate(w.lastActivity)}</span>
                  ),
                },
              ]}
              pageSize={10}
              isLoading={workersQuery.isLoading}
              serverPagination={{
                currentPage: workersQuery.data?.pagination.page ?? workPage,
                totalPages: workersQuery.data?.pagination.totalPages ?? 1,
                totalItems: workersQuery.data?.pagination.total ?? 0,
                pageSize: 10,
                onPageChange: (p) => setWorkPage(p),
              }}
              emptyMessage="No workers found."
            />
          )}

          {category === "customers" && (
            <DataTable
              rows={customersQuery.data?.data ?? []}
              columns={[
                {
                  key: "name",
                  header: "Customer",
                  sortValue: (c: Customer) => c.name,
                  render: (c: Customer) => (
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{formatPhone(c.phone)}</p>
                    </div>
                  ),
                },
                {
                  key: "group",
                  header: "Group",
                  render: (c: Customer) => c.groupName ?? "Standard (Default)",
                },
                {
                  key: "registered",
                  header: "Registered",
                  sortValue: (c: Customer) => c.registeredAt,
                  render: (c: Customer) => (
                    <span className="text-muted-foreground">{formatDate(c.registeredAt)}</span>
                  ),
                },
                {
                  key: "transactions",
                  header: "Transactions",
                  sortValue: (c: Customer) => c.transactions,
                  render: (c: Customer) => formatNumber(c.transactions),
                },
                {
                  key: "discount",
                  header: "Discount received",
                  sortValue: (c: Customer) => c.discountReceived,
                  render: (c: Customer) => (
                    <span className="font-medium text-teal">
                      {formatCurrency(c.discountReceived)}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  sortValue: (c: Customer) => c.status,
                  render: (c: Customer) => <StatusBadge status={c.status} />,
                },
              ]}
              pageSize={10}
              isLoading={customersQuery.isLoading}
              serverPagination={{
                currentPage: customersQuery.data?.pagination.page ?? custPage,
                totalPages: customersQuery.data?.pagination.totalPages ?? 1,
                totalItems: customersQuery.data?.pagination.total ?? 0,
                pageSize: 10,
                onPageChange: (p) => setCustPage(p),
              }}
              emptyMessage="No customers found."
            />
          )}

          {category === "groups" && (
            <DataTable
              rows={groupsQuery.data ?? []}
              columns={[
                {
                  key: "name",
                  header: "Group",
                  sortValue: (g: Group) => g.name,
                  render: (g: Group) => <span className="font-medium">{g.name}</span>,
                },
                {
                  key: "discountPercent",
                  header: "Discount %",
                  sortValue: (g: Group) => g.discountPercent,
                  render: (g: Group) => `${g.discountPercent}%`,
                },
                {
                  key: "customers",
                  header: "Customers",
                  sortValue: (g: Group) => g.customerCount ?? 0,
                  render: (g: Group) => formatNumber(g.customerCount ?? 0),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (g: Group) => <StatusBadge status={g.active ? "active" : "inactive"} />,
                },
              ]}
              pageSize={10}
              isLoading={groupsQuery.isLoading}
              emptyMessage="No groups found."
            />
          )}
        </div>
      </Panel>

      {/* Transaction Detail & Status Override Dialog */}
      <Dialog open={Boolean(selectedTxId)} onOpenChange={(open) => !open && setSelectedTxId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-6">
              <span>Transaction Details</span>
              {selectedTx && <StatusBadge status={selectedTx.status} />}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              ID: {selectedTx?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-6 pt-2">
              {/* Transaction Key Info */}
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-border/60 bg-muted/20 p-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-base font-semibold">{formatCurrency(selectedTx.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Discount ({selectedTx.discountPercent}%)
                  </p>
                  <p className="text-base font-semibold text-teal">
                    −{formatCurrency(selectedTx.discountAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net Payable</p>
                  <p className="text-base font-semibold text-foreground">
                    {formatCurrency(selectedTx.netPayable)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fuel & Litres</p>
                  <p className="text-sm font-medium">
                    {selectedTx.fuel ?? "—"} ·{" "}
                    {selectedTx.litres !== undefined && selectedTx.litres !== null
                      ? `${selectedTx.litres} L`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Customer & Worker Metadata */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Customer</p>
                  <p className="mt-1 font-medium text-foreground">{selectedTx.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedTx.customerPhone ? formatPhone(selectedTx.customerPhone) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Group: {selectedTx.groupName ?? "Standard (Default)"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Worker / Attendant
                  </p>
                  <p className="mt-1 font-medium text-foreground">{selectedTx.workerName}</p>
                  <p className="text-xs text-muted-foreground">
                    ID: {selectedTx.workerId.slice(0, 8)}…
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted: {formatDateTime(selectedTx.submittedAt)}
                  </p>
                  {selectedTx.resolvedAt && (
                    <p className="text-xs text-muted-foreground">
                      Resolved: {formatDateTime(selectedTx.resolvedAt)}
                    </p>
                  )}
                </div>
              </div>

              {selectedTx.failureReason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
                    <AlertTriangle className="size-4" />
                    Failure Reason
                  </div>
                  <p className="mt-1 text-xs text-destructive">{selectedTx.failureReason}</p>
                </div>
              )}

              {/* Admin Status Override Control */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">Admin Status Override</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Admins can transition status between Success and Failed. Reverting to Pending is
                  strictly prohibited.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs font-medium">New Status:</label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={targetStatus === "success" ? "default" : "outline"}
                      onClick={() => setTargetStatus("success")}
                      className={
                        targetStatus === "success" ? "bg-success text-success-foreground" : ""
                      }
                    >
                      Success
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={targetStatus === "failed" ? "destructive" : "outline"}
                      onClick={() => setTargetStatus("failed")}
                    >
                      Failed
                    </Button>
                  </div>
                </div>

                {targetStatus === "failed" && (
                  <div className="space-y-1">
                    <Label htmlFor="failureReason" className="text-xs">
                      Reason for failure:
                    </Label>
                    <Input
                      id="failureReason"
                      value={failureReason}
                      onChange={(e) => setFailureReason(e.target.value)}
                      placeholder="e.g. Pump meter discrepancy, cancelled by attendant"
                      className="text-xs"
                    />
                  </div>
                )}

                <div className="pt-1">
                  <Button
                    size="sm"
                    disabled={updateStatusMutation.isPending}
                    onClick={() => {
                      if (!selectedTxId) return;
                      updateStatusMutation.mutate({
                        id: selectedTxId,
                        status: targetStatus,
                        reason:
                          targetStatus === "failed"
                            ? failureReason.trim() || "Admin marked as failed"
                            : null,
                      });
                    }}
                  >
                    {updateStatusMutation.isPending
                      ? "Updating…"
                      : `Update Status to ${targetStatus}`}
                  </Button>
                </div>
              </div>

              {/* Status Change Audit History */}
              {statusHistory.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                    <History className="size-3.5" /> Status Change History
                  </div>
                  <div className="divide-y divide-border rounded-lg border border-border/60">
                    {statusHistory.map((h) => (
                      <div key={h.id} className="p-2.5 text-xs flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            {h.oldStatus ?? "initial"} →{" "}
                            <span className="font-semibold text-primary">{h.newStatus}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            By {h.actorName ?? "Admin"} ({h.actorType})
                            {h.reason ? ` · "${h.reason}"` : ""}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDateTime(h.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTxId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
