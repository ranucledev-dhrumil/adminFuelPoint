import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Fuel,
  Loader2,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/admin/DataTable";
import { GroupPill, PageHeader, Panel, StatCard, StatusBadge } from "@/components/admin/primitives";
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
  DEFAULT_GROUP_ID,
  customersApi,
  exportCsv,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPhone,
  groupsApi,
  relativeDays,
  reportsApi,
} from "@/services/adminService";
import type { Customer, CustomerQueryParams } from "@/services/types";

export const Route = createFileRoute("/_admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — FuelPoint Admin" },
      {
        name: "description",
        content:
          "Manage registered customers, assign discount groups and review fuelling activity.",
      },
      { property: "og:title", content: "Customers — FuelPoint Admin" },
      {
        property: "og:description",
        content: "Customer registrations, group assignment and discount received.",
      },
    ],
  }),
  component: CustomersPage,
});

interface CustomerFormData {
  id?: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  groupId: string;
  status?: "active" | "inactive";
}

const blankCustomer: CustomerFormData = {
  name: "",
  phone: "",
  email: "",
  vehicle: "",
  groupId: DEFAULT_GROUP_ID,
  status: "active",
};

function CustomersPage() {
  const queryClient = useQueryClient();

  // Query and table state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<NonNullable<CustomerQueryParams["sort_by"]>>("registeredAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Dialog states
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerFormData | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  const handleGroupFilterChange = (val: string) => {
    setGroupFilter(val);
    setPage(1);
  };

  const handleStatusFilterChange = (val: "all" | "active" | "inactive") => {
    setStatusFilter(val);
    setPage(1);
  };

  // Queries
  const { data: overview } = useQuery({
    queryKey: ["admin", "dashboard", "overview"],
    queryFn: reportsApi.getOverview,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["admin", "groups"],
    queryFn: groupsApi.list,
  });

  const {
    data: customerData,
    isLoading: isCustomersLoading,
    isFetching: isCustomersFetching,
  } = useQuery({
    queryKey: [
      "admin",
      "customers",
      {
        page,
        limit: pageSize,
        q: debouncedSearch,
        status: statusFilter,
        group_id: groupFilter,
        sort_by: sortBy,
        order: sortOrder,
      },
    ],
    queryFn: () =>
      customersApi.list({
        page,
        limit: pageSize,
        q: debouncedSearch || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        group_id: groupFilter === "all" ? undefined : groupFilter,
        sort_by: sortBy,
        order: sortOrder,
      }),
  });

  // Customer Detail Query
  const { data: customerDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ["admin", "customer", selectedId],
    queryFn: () => customersApi.getById(selectedId!),
    enabled: Boolean(selectedId),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: customersApi.create,
    onSuccess: (cust) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
      toast.success("Customer created", { description: cust.name });
      setEditingCustomer(null);
    },
    onError: (err: Error) => {
      toast.error("Failed to create customer", { description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!data.id) return;
      await customersApi.update(data.id, {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        vehicle: data.vehicle || null,
      });

      if (data.groupId) {
        await customersApi.assignGroup(data.id, data.groupId);
      }

      if (data.status) {
        await customersApi.updateStatus(data.id, data.status);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
      if (selectedId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "customer", selectedId] });
      }
      toast.success("Customer updated");
      setEditingCustomer(null);
    },
    onError: (err: Error) => {
      toast.error("Failed to update customer", { description: err.message });
    },
  });

  const statusToggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" }) =>
      customersApi.updateStatus(id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "overview"] });
      if (selectedId === updated.id) {
        queryClient.invalidateQueries({ queryKey: ["admin", "customer", selectedId] });
      }
      toast.success(updated.status === "active" ? "Customer activated" : "Customer deactivated", {
        description: updated.name,
      });
    },
    onError: (err: Error) => {
      toast.error("Failed to update status", { description: err.message });
    },
  });

  const assignGroupMutation = useMutation({
    mutationFn: ({
      id,
      groupId,
      customerName,
      groupName,
    }: {
      id: string;
      groupId: string;
      customerName: string;
      groupName: string;
    }) =>
      customersApi.assignGroup(id, groupId).then((updated) => ({
        ...updated,
        customerName,
        groupName: groupName || updated.groupName,
      })),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
      if (selectedId === data.id) {
        queryClient.invalidateQueries({ queryKey: ["admin", "customer", selectedId] });
      }
      toast.success(`${data.customerName} assigned to ${data.groupName || "group"}`);
    },
    onError: (err: Error) => {
      toast.error("Failed to assign group", { description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
      toast.success("Customer deleted");
      setDeletingCustomer(null);
      if (selectedId === deletingCustomer?.id) {
        setSelectedId(null);
      }
    },
    onError: (err: Error) => {
      toast.error("Failed to delete customer", { description: err.message });
    },
  });

  const handleFormSubmit = () => {
    if (!editingCustomer) return;
    if (!editingCustomer.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    const cleanPhone = editingCustomer.phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Valid 10-digit mobile number is required.");
      return;
    }

    if (editingCustomer.id) {
      updateMutation.mutate(editingCustomer);
    } else {
      createMutation.mutate({
        name: editingCustomer.name,
        phone: editingCustomer.phone,
        email: editingCustomer.email || null,
        vehicle: editingCustomer.vehicle || null,
        groupId: editingCustomer.groupId,
      });
    }
  };

  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? "Unassigned";
  const groupPercent = (id: string) => groups.find((g) => g.id === id)?.discountPercent ?? 0;

  // Sorting handler
  const handleSortChange = (key: string, dir: "asc" | "desc") => {
    const validSortKeys: Record<string, NonNullable<CustomerQueryParams["sort_by"]>> = {
      name: "name",
      registered: "registeredAt",
      registeredAt: "registeredAt",
      status: "status",
      txns: "transactions",
      transactions: "transactions",
      discount: "discountReceived",
      discountReceived: "discountReceived",
      totalSpend: "totalSpend",
      last: "lastActivity",
      lastActivity: "lastActivity",
    };

    const targetKey = validSortKeys[key] || "registeredAt";
    setSortBy(targetKey);
    setSortOrder(dir);
  };

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "Customer",
      sortValue: (c) => c.name,
      render: (c) => (
        <div>
          <p className="font-medium text-foreground">{c.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatPhone(c.phone)} {c.vehicle ? `· ${c.vehicle}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "group",
      header: "Group",
      render: (c) =>
        c.groupId === DEFAULT_GROUP_ID ? (
          <span className="inline-flex items-center rounded-full bg-warning/18 px-2.5 py-1 text-xs font-semibold text-warning">
            Unassigned
          </span>
        ) : (
          <GroupPill name={c.groupName || groupName(c.groupId)} percent={groupPercent(c.groupId)} />
        ),
    },
    {
      key: "registered",
      header: "Registered",
      sortValue: (c) => c.registeredAt,
      render: (c) => <span className="text-sm">{formatDate(c.registeredAt)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (c) => c.status,
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "txns",
      header: "Transactions",
      align: "right",
      sortValue: (c) => c.transactions,
      render: (c) => formatNumber(c.transactions),
    },
    {
      key: "discount",
      header: "Discount received",
      align: "right",
      sortValue: (c) => c.discountReceived,
      render: (c) => (
        <span className="font-medium text-teal">{formatCurrency(c.discountReceived)}</span>
      ),
    },
    {
      key: "last",
      header: "Last activity",
      align: "right",
      sortValue: (c) => c.lastActivity ?? "",
      render: (c) => (
        <span className="text-xs text-muted-foreground">{relativeDays(c.lastActivity)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title={c.status === "active" ? "Deactivate customer" : "Activate customer"}
            onClick={() =>
              statusToggleMutation.mutate({
                id: c.id,
                status: c.status === "active" ? "inactive" : "active",
              })
            }
          >
            <Power className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title="Edit customer"
            onClick={() =>
              setEditingCustomer({
                id: c.id,
                name: c.name,
                phone: c.phone,
                email: c.email || "",
                vehicle: c.vehicle || "",
                groupId: c.groupId,
                status: c.status,
              })
            }
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Delete customer"
            onClick={() => setDeletingCustomer(c)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  const handleExportCsv = () => {
    const rows = (customerData?.data ?? []).map((c) => ({
      ID: c.id,
      Name: c.name,
      Phone: c.phone,
      Email: c.email || "",
      Vehicle: c.vehicle || "",
      Group: c.groupName || groupName(c.groupId),
      Status: c.status,
      Registered: c.registeredAt,
      Transactions: c.transactions,
      "Total Spend": c.totalSpend,
      "Discount Received": c.discountReceived,
      "Last Activity": c.lastActivity || "",
    }));
    exportCsv(`customers-page-${page}.csv`, rows);
  };

  const selectedCustomer = customerDetail?.customer;
  const recentTransactions = customerDetail?.recentTransactions ?? [];

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Search customers, assign discount groups and review fuelling activity."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportCsv}>
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={() => setEditingCustomer({ ...blankCustomer })}>
              <Plus className="size-4" /> New customer
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total customers"
          value={formatNumber(overview?.totalCustomers ?? 0)}
          icon={Users}
        />
        <StatCard
          label="Active customers"
          value={formatNumber(overview?.activeCustomers ?? 0)}
          icon={UserCheck}
          tone="teal"
        />
        <StatCard
          label="Unassigned"
          value={formatNumber(overview?.unassignedCustomers ?? 0)}
          icon={UserPlus}
          tone="warning"
        />
        <StatCard
          label="Total discount given"
          value={formatCurrency(overview?.totalDiscount ?? 0)}
          icon={Fuel}
          tone="teal"
        />
      </div>

      <Panel className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, email…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={groupFilter} onValueChange={handleGroupFilterChange}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTable
          rows={customerData?.data ?? []}
          columns={columns}
          pageSize={pageSize}
          isLoading={isCustomersLoading || isCustomersFetching}
          serverPagination={{
            currentPage: customerData?.pagination.page ?? page,
            totalPages: customerData?.pagination.totalPages ?? 1,
            totalItems: customerData?.pagination.total ?? 0,
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
          onRowClick={(c) => setSelectedId(c.id)}
        />
      </Panel>

      {/* Customer Detail Dialog */}
      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="sm:max-w-xl">
          {isDetailLoading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
          {!isDetailLoading && selectedCustomer && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-6">
                  <div>
                    <DialogTitle>{selectedCustomer.name}</DialogTitle>
                    <DialogDescription>
                      {formatPhone(selectedCustomer.phone)}
                      {selectedCustomer.email ? ` · ${selectedCustomer.email}` : ""}
                      {selectedCustomer.vehicle ? ` · ${selectedCustomer.vehicle}` : ""}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Edit customer"
                      onClick={() => {
                        setEditingCustomer({
                          id: selectedCustomer.id,
                          name: selectedCustomer.name,
                          phone: selectedCustomer.phone,
                          email: selectedCustomer.email || "",
                          vehicle: selectedCustomer.vehicle || "",
                          groupId: selectedCustomer.groupId,
                          status: selectedCustomer.status,
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
                      title="Delete customer"
                      onClick={() => {
                        setDeletingCustomer(selectedCustomer);
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
                  ["Registered", formatDate(selectedCustomer.registeredAt)],
                  ["Transactions", formatNumber(selectedCustomer.transactions)],
                  ["Total spend", formatCurrency(selectedCustomer.totalSpend)],
                  ["Discount", formatCurrency(selectedCustomer.discountReceived)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">{l}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{v}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Discount group & Status
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Select
                    value={selectedCustomer.groupId}
                    onValueChange={(v) => {
                      const targetGroup = groups.find((g) => g.id === v);
                      assignGroupMutation.mutate({
                        id: selectedCustomer.id,
                        groupId: v,
                        customerName: selectedCustomer.name,
                        groupName: targetGroup?.name || "",
                      });
                    }}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {groups
                        .filter((g) => g.active || g.id === selectedCustomer.groupId)
                        .map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name} — {g.discountPercent}%
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      statusToggleMutation.mutate({
                        id: selectedCustomer.id,
                        status: selectedCustomer.status === "active" ? "inactive" : "active",
                      })
                    }
                  >
                    <Power className="size-3.5" />
                    {selectedCustomer.status === "active" ? "Deactivate" : "Activate"}
                  </Button>

                  <StatusBadge status={selectedCustomer.status} />
                </div>
              </div>

              <div className="rounded-lg border border-border">
                <p className="border-b border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">
                  Recent activity
                </p>
                <ul className="scrollbar-thin max-h-56 divide-y divide-border overflow-y-auto">
                  {recentTransactions.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between px-4 py-2.5 text-sm"
                    >
                      <span>
                        {t.fuel || "Fuel"} {t.litres ? `· ${t.litres} L` : ""}
                        <span className="block text-xs text-muted-foreground">
                          {formatDateTime(t.submittedAt)} {t.workerName ? `· ${t.workerName}` : ""}
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
                      This customer hasn't fuelled yet.
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Customer Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={(o) => !o && setEditingCustomer(null)}>
        <DialogContent className="sm:max-w-lg">
          {editingCustomer && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer.id ? "Edit Customer" : "Register New Customer"}
                </DialogTitle>
                <DialogDescription>
                  {editingCustomer.id
                    ? "Update contact info, vehicle, and group assignment."
                    : "Add customer details. They can immediately scan and receive group discounts."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="c-name">Full name *</Label>
                  <Input
                    id="c-name"
                    value={editingCustomer.name}
                    onChange={(e) =>
                      setEditingCustomer({ ...editingCustomer, name: e.target.value })
                    }
                    placeholder="e.g. Rahul Sharma"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="c-phone">Phone number *</Label>
                    <div className="flex rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring">
                      <span className="flex items-center px-3 text-sm font-medium text-muted-foreground border-r border-input select-none bg-muted/40 rounded-l-md">
                        +91
                      </span>
                      <input
                        id="c-phone"
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={editingCustomer.phone.replace(/^\+91/, "").replace(/\D/g, "")}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setEditingCustomer({
                            ...editingCustomer,
                            phone: digits ? `+91${digits}` : "",
                          });
                        }}
                        className="flex h-9 w-full rounded-r-md bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="9876543210"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">10-digit Indian mobile number</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-email">Email (optional)</Label>
                    <Input
                      id="c-email"
                      type="email"
                      value={editingCustomer.email}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, email: e.target.value })
                      }
                      placeholder="rahul@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="c-vehicle">Vehicle number</Label>
                    <Input
                      id="c-vehicle"
                      value={editingCustomer.vehicle}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, vehicle: e.target.value })
                      }
                      placeholder="MH12 AB 1234"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Discount Group</Label>
                    <Select
                      value={editingCustomer.groupId}
                      onValueChange={(v) => setEditingCustomer({ ...editingCustomer, groupId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {groups
                          .filter((g) => g.active || g.id === editingCustomer.groupId)
                          .map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name} ({g.discountPercent}%)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {editingCustomer.id && (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editingCustomer.status || "active"}
                      onValueChange={(v: "active" | "inactive") =>
                        setEditingCustomer({ ...editingCustomer, status: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditingCustomer(null)}>
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
                  ) : editingCustomer.id ? (
                    "Save changes"
                  ) : (
                    "Register customer"
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!deletingCustomer} onOpenChange={(o) => !o && setDeletingCustomer(null)}>
        <AlertDialogContent>
          {deletingCustomer && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {deletingCustomer.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark the customer as deleted. Their past transaction records will be
                  preserved for auditing.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate(deletingCustomer.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Deleting…
                    </>
                  ) : (
                    "Delete customer"
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
