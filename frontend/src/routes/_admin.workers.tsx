import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BadgePercent,
  Download,
  Loader2,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  UserCheck,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/admin/DataTable";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  exportCsv,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPhone,
  relativeDays,
  reportsApi,
  workersApi,
} from "@/services/adminService";
import type { Worker, WorkerQueryParams } from "@/services/types";

export const Route = createFileRoute("/_admin/workers")({
  head: () => ({
    meta: [
      { title: "Workers — FuelPoint Admin" },
      {
        name: "description",
        content: "Manage pump workers, monitor scans, transactions handled and discount processed.",
      },
      { property: "og:title", content: "Workers — FuelPoint Admin" },
      {
        property: "og:description",
        content: "Worker performance: scans, customers scanned and discount processed.",
      },
    ],
  }),
  component: WorkersPage,
});

interface WorkerFormData {
  id?: string;
  name: string;
  phone: string;
  email: string;
  shift: "Morning" | "Evening" | "Night";
  status?: "active" | "offline" | "suspended";
}

const blankWorker: WorkerFormData = {
  name: "",
  phone: "",
  email: "",
  shift: "Morning",
  status: "active",
};

function WorkersPage() {
  const queryClient = useQueryClient();

  // Query and table state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "offline" | "suspended">(
    "all",
  );
  const [shiftFilter, setShiftFilter] = useState<"all" | "Morning" | "Evening" | "Night">("all");
  const [sortBy, setSortBy] = useState<NonNullable<WorkerQueryParams["sort_by"]>>("joinedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Dialog states
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingWorker, setEditingWorker] = useState<WorkerFormData | null>(null);
  const [deletingWorker, setDeletingWorker] = useState<Worker | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Overview Query
  const { data: overview } = useQuery({
    queryKey: ["admin", "dashboard", "overview"],
    queryFn: reportsApi.getOverview,
  });

  // Workers List Query
  const {
    data: workerData,
    isLoading: isWorkersLoading,
    isFetching: isWorkersFetching,
  } = useQuery({
    queryKey: [
      "admin",
      "workers",
      {
        page,
        limit: pageSize,
        q: debouncedSearch,
        status: statusFilter,
        shift: shiftFilter,
        sort_by: sortBy,
        order: sortOrder,
      },
    ],
    queryFn: () =>
      workersApi.list({
        page,
        limit: pageSize,
        q: debouncedSearch || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        shift: shiftFilter === "all" ? undefined : shiftFilter,
        sort_by: sortBy,
        order: sortOrder,
      }),
  });

  // Worker Detail Query
  const { data: workerDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ["admin", "worker", selectedId],
    queryFn: () => workersApi.getById(selectedId!),
    enabled: Boolean(selectedId),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: workersApi.create,
    onSuccess: (w) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "workers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "overview"] });
      toast.success("Worker created", { description: w.name });
      setEditingWorker(null);
    },
    onError: (err: Error) => {
      toast.error("Failed to create worker", { description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: WorkerFormData) => {
      if (!data.id) return;
      await workersApi.update(data.id, {
        name: data.name,
        phone: data.phone,
        email: data.email,
        shift: data.shift,
      });

      if (data.status) {
        await workersApi.updateStatus(data.id, data.status);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "workers"] });
      if (selectedId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "worker", selectedId] });
      }
      toast.success("Worker updated");
      setEditingWorker(null);
    },
    onError: (err: Error) => {
      toast.error("Failed to update worker", { description: err.message });
    },
  });

  const statusToggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "suspended" | "offline" }) =>
      workersApi.updateStatus(id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "workers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "overview"] });
      if (selectedId === updated.id) {
        queryClient.invalidateQueries({ queryKey: ["admin", "worker", selectedId] });
      }
      toast.success(
        updated.status === "active" ? "Worker activated" : `Worker status set to ${updated.status}`,
        { description: updated.name },
      );
    },
    onError: (err: Error) => {
      toast.error("Failed to update status", { description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "workers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "overview"] });
      toast.success("Worker deleted");
      setDeletingWorker(null);
      if (selectedId === deletingWorker?.id) {
        setSelectedId(null);
      }
    },
    onError: (err: Error) => {
      toast.error("Failed to delete worker", { description: err.message });
    },
  });

  const handleFormSubmit = () => {
    if (!editingWorker) return;
    if (!editingWorker.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    const cleanPhone = editingWorker.phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Valid 10-digit mobile number is required.");
      return;
    }
    if (!editingWorker.email.trim() || !editingWorker.email.includes("@")) {
      toast.error("Valid email address is required.");
      return;
    }

    if (editingWorker.id) {
      updateMutation.mutate(editingWorker);
    } else {
      createMutation.mutate({
        name: editingWorker.name,
        phone: editingWorker.phone,
        email: editingWorker.email,
        shift: editingWorker.shift,
        status: editingWorker.status || "active",
      });
    }
  };

  const handleSortChange = (key: string, dir: "asc" | "desc") => {
    const validSortKeys: Record<string, NonNullable<WorkerQueryParams["sort_by"]>> = {
      name: "name",
      status: "status",
      scans: "scans",
      customers: "customersScanned",
      customersScanned: "customersScanned",
      txns: "transactions",
      transactions: "transactions",
      discount: "discountProcessed",
      discountProcessed: "discountProcessed",
      last: "lastActivity",
      lastActivity: "lastActivity",
      shift: "shift",
      joined: "joinedAt",
      joinedAt: "joinedAt",
    };

    const targetKey = validSortKeys[key] || "joinedAt";
    setSortBy(targetKey);
    setSortOrder(dir);
  };

  const columns: Column<Worker>[] = [
    {
      key: "name",
      header: "Worker",
      sortValue: (w) => w.name,
      render: (w) => (
        <div className="flex items-center gap-3">
          <span className="gradient-brand flex size-9 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground">
            {w.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </span>
          <div>
            <p className="font-medium text-foreground">{w.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatPhone(w.phone)} · {w.shift} shift
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (w) => w.status,
      render: (w) => <StatusBadge status={w.status} />,
    },
    {
      key: "scans",
      header: "Scans",
      align: "right",
      sortValue: (w) => w.scans,
      render: (w) => formatNumber(w.scans),
    },
    {
      key: "customers",
      header: "Customers",
      align: "right",
      sortValue: (w) => w.customersScanned,
      render: (w) => formatNumber(w.customersScanned),
    },
    {
      key: "transactions",
      header: "Transactions",
      align: "right",
      sortValue: (w) => w.transactions,
      render: (w) => formatNumber(w.transactions),
    },
    {
      key: "discount",
      header: "Discount processed",
      align: "right",
      sortValue: (w) => w.discountProcessed,
      render: (w) => (
        <span className="font-medium text-teal">{formatCurrency(w.discountProcessed)}</span>
      ),
    },
    {
      key: "last",
      header: "Last activity",
      align: "right",
      sortValue: (w) => w.lastActivity ?? "",
      render: (w) => (
        <span className="text-xs text-muted-foreground">{relativeDays(w.lastActivity)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (w) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title={w.status === "active" ? "Suspend worker" : "Activate worker"}
            onClick={() =>
              statusToggleMutation.mutate({
                id: w.id,
                status: w.status === "active" ? "suspended" : "active",
              })
            }
          >
            <Power className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title="Edit worker"
            onClick={() =>
              setEditingWorker({
                id: w.id,
                name: w.name,
                phone: w.phone,
                email: w.email,
                shift: w.shift,
                status: w.status,
              })
            }
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Delete worker"
            onClick={() => setDeletingWorker(w)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  const handleExportCsv = () => {
    const rows = (workerData?.data ?? []).map((w) => ({
      ID: w.id,
      Name: w.name,
      Phone: w.phone,
      Email: w.email,
      Shift: w.shift,
      Status: w.status,
      Joined: w.joinedAt,
      Scans: w.scans,
      "Customers Scanned": w.customersScanned,
      Transactions: w.transactions,
      "Discount Processed": w.discountProcessed,
      "Last Activity": w.lastActivity || "",
    }));
    exportCsv(`workers-page-${page}.csv`, rows);
  };

  const selectedWorker = workerDetail?.worker;
  const recentTransactions = workerDetail?.recentTransactions ?? [];

  return (
    <>
      <PageHeader
        title="Workers"
        subtitle="Scanning activity and discount handling per worker."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportCsv}>
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={() => setEditingWorker({ ...blankWorker })}>
              <Plus className="size-4" /> New Worker
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total workers"
          value={formatNumber(overview?.totalWorkers ?? 0)}
          icon={Wrench}
        />
        <StatCard
          label="Active workers"
          value={formatNumber(overview?.activeWorkers ?? 0)}
          icon={UserCheck}
          tone="teal"
        />
        <StatCard
          label="Today transactions"
          value={formatNumber(overview?.todayTransactions ?? 0)}
          icon={Activity}
          tone="navy"
        />
        <StatCard
          label="Total discount handled"
          value={formatCurrency(overview?.totalDiscount ?? 0)}
          icon={BadgePercent}
          tone="teal"
        />
      </div>

      <Panel
        title="Worker directory"
        description="Search, filter and sort the team"
        className="mt-6"
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-border px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone or email…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v: "all" | "active" | "offline" | "suspended") => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={shiftFilter}
            onValueChange={(v: "all" | "Morning" | "Evening" | "Night") => {
              setShiftFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All shifts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All shifts</SelectItem>
              <SelectItem value="Morning">Morning</SelectItem>
              <SelectItem value="Evening">Evening</SelectItem>
              <SelectItem value="Night">Night</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          rows={workerData?.data ?? []}
          columns={columns}
          pageSize={pageSize}
          isLoading={isWorkersLoading || isWorkersFetching}
          serverPagination={{
            currentPage: workerData?.pagination.page ?? page,
            totalPages: workerData?.pagination.totalPages ?? 1,
            totalItems: workerData?.pagination.total ?? 0,
            pageSize,
            onPageChange: (p) => setPage(p),
            onPageSizeChange: (s) => {
              setPageSize(s);
              setPage(1);
            },
            sortKey: sortBy,
            sortDir: sortOrder,
            onSortChange: handleSortChange,
          }}
          onRowClick={(w) => setSelectedId(w.id)}
        />
      </Panel>

      {/* Worker Detail Dialog */}
      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="sm:max-w-xl">
          {isDetailLoading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
          {!isDetailLoading && selectedWorker && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-6">
                  <div>
                    <DialogTitle>{selectedWorker.name}</DialogTitle>
                    <DialogDescription>
                      {selectedWorker.email} · {formatPhone(selectedWorker.phone)} ·{" "}
                      {selectedWorker.shift} shift · Joined {formatDate(selectedWorker.joinedAt)}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Edit worker"
                      onClick={() => {
                        setEditingWorker({
                          id: selectedWorker.id,
                          name: selectedWorker.name,
                          phone: selectedWorker.phone,
                          email: selectedWorker.email,
                          shift: selectedWorker.shift,
                          status: selectedWorker.status,
                        });
                        setSelectedId(null);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Delete worker"
                      onClick={() => {
                        setDeletingWorker(selectedWorker);
                        setSelectedId(null);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mt-2">
                {[
                  ["Scans", formatNumber(selectedWorker.scans)],
                  ["Customers", formatNumber(selectedWorker.customersScanned)],
                  ["Transactions", formatNumber(selectedWorker.transactions)],
                  ["Discount", formatCurrency(selectedWorker.discountProcessed)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">{l}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{v}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Status & Controls
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedWorker.status} />
                    <span className="text-xs text-muted-foreground">
                      Last active: {relativeDays(selectedWorker.lastActivity)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      statusToggleMutation.mutate({
                        id: selectedWorker.id,
                        status: selectedWorker.status === "active" ? "suspended" : "active",
                      })
                    }
                  >
                    <Power className="size-3.5" />
                    {selectedWorker.status === "active" ? "Suspend worker" : "Activate worker"}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border">
                <p className="border-b border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">
                  Recent activity
                </p>
                <ul className="scrollbar-thin max-h-64 divide-y divide-border overflow-y-auto">
                  {recentTransactions.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                    >
                      <span>
                        <span className="font-medium">{t.customerName || "Customer"}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDateTime(t.submittedAt)} {t.fuel ? `· ${t.fuel}` : ""}
                        </span>
                      </span>
                      <span className="text-right">
                        {formatCurrency(t.amount)}
                        <span className="block text-xs text-teal">
                          −{formatCurrency(t.discountAmount)}
                        </span>
                      </span>
                    </li>
                  ))}
                  {recentTransactions.length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No transactions recorded.
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Worker Dialog */}
      <Dialog open={!!editingWorker} onOpenChange={(o) => !o && setEditingWorker(null)}>
        <DialogContent className="sm:max-w-md">
          {editingWorker && (
            <>
              <DialogHeader>
                <DialogTitle>{editingWorker.id ? "Edit Worker" : "Register Worker"}</DialogTitle>
                <DialogDescription>
                  {editingWorker.id
                    ? "Update worker details and shift assignment."
                    : "Workers log in using phone/email OTP. No password required."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="w-name">Full name *</Label>
                  <Input
                    id="w-name"
                    placeholder="e.g. Ramesh Singh"
                    value={editingWorker.name}
                    onChange={(e) => setEditingWorker({ ...editingWorker, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="w-phone">Phone number *</Label>
                    <div className="flex rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring">
                      <span className="flex items-center px-3 text-sm font-medium text-muted-foreground border-r border-input select-none bg-muted/40 rounded-l-md">
                        +91
                      </span>
                      <input
                        id="w-phone"
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={editingWorker.phone.replace(/^\+91/, "").replace(/\D/g, "")}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setEditingWorker({
                            ...editingWorker,
                            phone: digits ? `+91${digits}` : "",
                          });
                        }}
                        className="flex h-9 w-full rounded-r-md bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="9876543210"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">10-digit mobile number</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="w-email">Email *</Label>
                    <Input
                      id="w-email"
                      type="email"
                      placeholder="ramesh@fuelpoint.in"
                      value={editingWorker.email}
                      onChange={(e) =>
                        setEditingWorker({ ...editingWorker, email: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Shift</Label>
                    <Select
                      value={editingWorker.shift}
                      onValueChange={(v: "Morning" | "Evening" | "Night") =>
                        setEditingWorker({ ...editingWorker, shift: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Morning">Morning</SelectItem>
                        <SelectItem value="Evening">Evening</SelectItem>
                        <SelectItem value="Night">Night</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editingWorker.id && (
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={editingWorker.status || "active"}
                        onValueChange={(v: "active" | "offline" | "suspended") =>
                          setEditingWorker({ ...editingWorker, status: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="offline">Offline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditingWorker(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleFormSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Saving…
                    </>
                  ) : editingWorker.id ? (
                    "Save changes"
                  ) : (
                    "Register worker"
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!deletingWorker} onOpenChange={(o) => !o && setDeletingWorker(null)}>
        <AlertDialogContent>
          {deletingWorker && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {deletingWorker.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark the worker as deleted. Their past scans and transactions will
                  remain intact for pump accounting.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate(deletingWorker.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Deleting…
                    </>
                  ) : (
                    "Delete worker"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
