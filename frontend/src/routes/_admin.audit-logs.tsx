import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileCode,
  Filter,
  History,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  User,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Column, DataTable } from "@/components/admin/DataTable";
import { PageHeader, Panel, StatCard } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  auditLogsApi,
  formatDate,
  formatDateTime,
  formatNumber,
  type RangeKey,
} from "@/services/adminService";
import type { AuditLogEntry } from "@/services/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_admin/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs — FuelPoint Admin" },
      {
        name: "description",
        content:
          "System audit trail: track rejected QR scans, transaction status alterations, and security events.",
      },
      { property: "og:title", content: "Audit Logs — FuelPoint Admin" },
      {
        property: "og:description",
        content:
          "Immutable audit logs with actor metadata, IP addresses and scan rejection reason codes.",
      },
    ],
  }),
  component: AuditLogsPage,
});

const actionOptions = [
  { value: "all", label: "All actions" },
  { value: "scan.rejected", label: "Rejected Scans (scan.rejected)" },
  { value: "transaction.created", label: "Transaction Created (transaction.created)" },
  { value: "transaction.status_changed", label: "Transaction Status (transaction.status_changed)" },
  { value: "customer.status_changed", label: "Customer Status (customer.status_changed)" },
  { value: "worker.status_changed", label: "Worker Status (worker.status_changed)" },
  { value: "admin.profile_updated", label: "Admin Profile (admin.profile_updated)" },
  { value: "admin.password_changed", label: "Admin Password (admin.password_changed)" },
];

const actorTypeOptions = [
  { value: "all", label: "All actors" },
  { value: "admin", label: "Admin" },
  { value: "worker", label: "Worker" },
  { value: "customer", label: "Customer" },
  { value: "system", label: "System" },
];

function computeRangeDates(range: RangeKey, customFrom: string, customTo: string) {
  const now = new Date();
  const formatYmd = (d: Date) => d.toISOString().slice(0, 10);
  const to = formatYmd(now);

  if (range === "today") return { from: to, to };
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

function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [actionFilter, setActionFilter] = useState("all");
  const [actorTypeFilter, setActorTypeFilter] = useState("all");
  const [reasonQuery, setReasonQuery] = useState("");

  const [range, setRange] = useState<RangeKey>("month");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  const { from: fromStr, to: toStr } = computeRangeDates(range, customFrom, customTo);

  const auditQuery = useQuery({
    queryKey: [
      "admin",
      "audit-logs",
      {
        page,
        limit: pageSize,
        action: actionFilter === "all" ? undefined : actionFilter,
        actorType:
          actorTypeFilter === "all"
            ? undefined
            : (actorTypeFilter as "admin" | "worker" | "customer" | "system"),
        reason: reasonQuery.trim() || undefined,
        from: fromStr,
        to: toStr,
      },
    ],
    queryFn: () =>
      auditLogsApi.list({
        page,
        limit: pageSize,
        action: actionFilter === "all" ? undefined : actionFilter,
        actorType:
          actorTypeFilter === "all"
            ? undefined
            : (actorTypeFilter as "admin" | "worker" | "customer" | "system"),
        reason: reasonQuery.trim() || undefined,
        from: fromStr,
        to: toStr,
      }),
  });

  const rejectedScansQuery = useQuery({
    queryKey: ["admin", "audit-logs", "rejected-count", fromStr, toStr],
    queryFn: () =>
      auditLogsApi.list({
        action: "scan.rejected",
        from: fromStr,
        to: toStr,
        limit: 1,
      }),
  });

  const statusChangesQuery = useQuery({
    queryKey: ["admin", "audit-logs", "status-changes-count", fromStr, toStr],
    queryFn: () =>
      auditLogsApi.list({
        action: "transaction.status_changed",
        from: fromStr,
        to: toStr,
        limit: 1,
      }),
  });

  const resetFilters = () => {
    setActionFilter("all");
    setActorTypeFilter("all");
    setReasonQuery("");
    setRange("month");
    setPage(1);
  };

  const columns: Column<AuditLogEntry>[] = [
    {
      key: "createdAt",
      header: "Timestamp",
      render: (entry) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateTime(entry.createdAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (entry) => {
        const isScanRejected = entry.action === "scan.rejected";
        const isStatusChange = entry.action.includes("status_changed");

        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              isScanRejected
                ? "bg-destructive/15 text-destructive"
                : isStatusChange
                  ? "bg-primary/12 text-primary"
                  : "bg-muted text-foreground",
            )}
          >
            {isScanRejected && <AlertTriangle className="size-3" />}
            {entry.action}
          </span>
        );
      },
    },
    {
      key: "reason",
      header: "Rejection / Reason Code",
      render: (entry) => {
        if (!entry.reason) {
          return <span className="text-muted-foreground text-xs">—</span>;
        }

        const isRejection =
          entry.action === "scan.rejected" ||
          entry.reason.includes("INACTIVE") ||
          entry.reason.includes("NOT_FOUND") ||
          entry.reason.includes("INVALID");

        return (
          <span
            className={cn(
              "inline-flex items-center rounded px-2 py-0.5 font-mono text-xs font-semibold",
              isRejection
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-muted text-foreground",
            )}
          >
            {entry.reason}
          </span>
        );
      },
    },
    {
      key: "actor",
      header: "Actor Metadata",
      render: (entry) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-xs text-foreground">
              {entry.actorName || "System / Anonymous"}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] uppercase font-semibold text-muted-foreground">
              {entry.actorType}
            </span>
          </div>
          {entry.actorId && (
            <p className="font-mono text-[10px] text-muted-foreground">
              ID: {entry.actorId.slice(0, 8)}…
            </p>
          )}
        </div>
      ),
    },
    {
      key: "entity",
      header: "Entity",
      render: (entry) => {
        if (!entry.entityType) {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        return (
          <div className="text-xs">
            <span className="capitalize font-medium text-foreground">{entry.entityType}</span>
            {entry.entityId && (
              <p className="font-mono text-[10px] text-muted-foreground">
                {entry.entityId.slice(0, 8)}…
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "ipAddress",
      header: "IP Address",
      render: (entry) => (
        <span className="font-mono text-xs text-muted-foreground">{entry.ipAddress || "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (entry) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedEntry(entry);
          }}
        >
          View Details
        </Button>
      ),
    },
  ];

  const totalLogs = auditQuery.data?.pagination.total ?? 0;
  const rejectedCount = rejectedScansQuery.data?.pagination.total ?? 0;
  const statusChangeCount = statusChangesQuery.data?.pagination.total ?? 0;

  return (
    <>
      <PageHeader
        title="Audit Logs"
        subtitle="Security audit trail of transactions, QR validations, scans, and administrator events."
        actions={
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <RotateCcw className="size-3.5" /> Reset Filters
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Audit Events" value={formatNumber(totalLogs)} icon={History} />
        <StatCard
          label="Rejected Scans in Range"
          value={formatNumber(rejectedCount)}
          icon={AlertTriangle}
          tone="warning"
          hint="QR validation failures"
        />
        <StatCard
          label="Status Changes in Range"
          value={formatNumber(statusChangeCount)}
          icon={Shield}
          tone="teal"
          hint="Admin & worker overrides"
        />
      </div>

      <Panel title="Event History" description="Chronological audit records" className="mt-6">
        {/* Filters Row */}
        <div className="mb-6 flex flex-wrap items-end gap-3 border-b border-border/40 pb-5">
          <div className="space-y-1">
            <Label className="text-xs">Action Type</Label>
            <select
              aria-label="Filter by action type"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {actionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Actor Type</Label>
            <select
              aria-label="Filter by actor type"
              value={actorTypeFilter}
              onChange={(e) => {
                setActorTypeFilter(e.target.value);
                setPage(1);
              }}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {actorTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Reason Code</Label>
            <Input
              placeholder="e.g. CUSTOMER_INACTIVE"
              value={reasonQuery}
              onChange={(e) => {
                setReasonQuery(e.target.value);
                setPage(1);
              }}
              className="h-9 w-48 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Range</Label>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              {(["today", "week", "month", "quarter", "custom"] as RangeKey[]).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRange(r);
                    setPage(1);
                  }}
                  className={
                    range === r
                      ? "rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm"
                      : "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                  }
                >
                  {r === "quarter" ? "90d" : r}
                </button>
              ))}
            </div>
          </div>

          {range === "custom" && (
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="audit-from" className="text-xs">
                  From
                </Label>
                <Input
                  id="audit-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => {
                    setCustomFrom(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-36 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="audit-to" className="text-xs">
                  To
                </Label>
                <Input
                  id="audit-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => {
                    setCustomTo(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-36 text-xs"
                />
              </div>
            </div>
          )}

          <p className="ml-auto text-xs text-muted-foreground">
            {formatDate(fromStr)} → {formatDate(toStr)}
          </p>
        </div>

        {/* Audit Log Table */}
        <DataTable
          rows={auditQuery.data?.data ?? []}
          columns={columns}
          pageSize={pageSize}
          isLoading={auditQuery.isLoading || auditQuery.isFetching}
          emptyMessage="No audit log entries found matching the filter criteria."
          serverPagination={{
            currentPage: auditQuery.data?.pagination.page ?? page,
            totalPages: auditQuery.data?.pagination.totalPages ?? 1,
            totalItems: auditQuery.data?.pagination.total ?? 0,
            pageSize,
            onPageChange: (p) => setPage(p),
            onPageSizeChange: (s) => {
              setPageSize(s);
              setPage(1);
            },
          }}
          onRowClick={(entry) => setSelectedEntry(entry)}
        />
      </Panel>

      {/* Audit Log Entry Detail Dialog */}
      <Dialog
        open={Boolean(selectedEntry)}
        onOpenChange={(open) => !open && setSelectedEntry(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-primary" />
              <span>Audit Event Inspector</span>
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              Event ID: {selectedEntry?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/20 p-3">
                <div>
                  <p className="text-muted-foreground">Action</p>
                  <p className="font-semibold text-foreground text-sm">{selectedEntry.action}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Timestamp</p>
                  <p className="font-semibold text-foreground text-sm">
                    {formatDateTime(selectedEntry.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Actor</p>
                  <p className="font-medium text-foreground">
                    {selectedEntry.actorName || "System"} ({selectedEntry.actorType})
                  </p>
                  {selectedEntry.actorId && (
                    <p className="font-mono text-[10px] text-muted-foreground">
                      ID: {selectedEntry.actorId}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">IP Address & Agent</p>
                  <p className="font-mono text-foreground">{selectedEntry.ipAddress || "—"}</p>
                  {selectedEntry.userAgent && (
                    <p
                      className="truncate text-[10px] text-muted-foreground"
                      title={selectedEntry.userAgent}
                    >
                      {selectedEntry.userAgent}
                    </p>
                  )}
                </div>
              </div>

              {selectedEntry.reason && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                  <p className="font-semibold text-destructive">Rejection / Reason Code</p>
                  <p className="mt-1 font-mono text-sm font-bold text-destructive">
                    {selectedEntry.reason}
                  </p>
                </div>
              )}

              {(selectedEntry.oldStatus || selectedEntry.newStatus) && (
                <div className="rounded-lg border border-border p-3 flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground">Old Status</p>
                    <p className="font-medium">{selectedEntry.oldStatus || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">New Status</p>
                    <p className="font-semibold text-primary">{selectedEntry.newStatus || "—"}</p>
                  </div>
                </div>
              )}

              {selectedEntry.newValue && (
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">New Value Snapshot</p>
                  <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] text-foreground">
                    {JSON.stringify(selectedEntry.newValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEntry.oldValue && (
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Old Value Snapshot</p>
                  <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] text-foreground">
                    {JSON.stringify(selectedEntry.oldValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEntry(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
