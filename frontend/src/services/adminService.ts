import { apiRequest, apiRequestBlob } from "@/lib/api-client";
import type {
  AdminProfile,
  AdminTransaction,
  AdminTransactionDetail,
  AdminTransactionQueryParams,
  AuditLogEntry,
  AuditLogQueryParams,
  Customer,
  CustomerDetail,
  CustomerQueryParams,
  CustomerTransaction,
  GlobalSearchResult,
  Group,
  GroupDistributionItem,
  MetricItem,
  Notification,
  NotificationQueryParams,
  PaginationMeta,
  ReportsSummary,
  SeriesPoint,
  Worker,
  WorkerActivityItem,
  WorkerDetail,
  WorkerQueryParams,
  WorkerTransaction,
} from "./types";
import { DEFAULT_GROUP_ID } from "./types";

export { DEFAULT_GROUP_ID };

/* ---------- mappers for API normalization ---------- */

function mapGroup(raw: unknown): Group {
  const g = raw as Record<string, unknown>;
  return {
    id: String(g["id"] ?? ""),
    name: String(g["name"] ?? ""),
    discountPercent: Number(g["discountPercent"] ?? 0),
    description: g["description"] ? String(g["description"]) : null,
    active: Boolean(g["active"]),
    isDefault: Boolean(g["isDefault"]),
    customerCount: Number(g["customerCount"] ?? 0),
    createdAt: String(g["createdAt"] ?? ""),
    updatedAt: g["updatedAt"] ? String(g["updatedAt"]) : undefined,
  };
}

function mapCustomer(raw: unknown): Customer {
  const c = raw as Record<string, unknown>;
  return {
    id: String(c["id"] ?? ""),
    name: String(c["name"] ?? ""),
    phone: String(c["phone"] ?? ""),
    email: c["email"] ? String(c["email"]) : null,
    vehicle: c["vehicle"] ? String(c["vehicle"]) : null,
    groupId: String(c["groupId"] ?? DEFAULT_GROUP_ID),
    groupName: c["groupName"] ? String(c["groupName"]) : undefined,
    registeredAt: String(c["registeredAt"] ?? ""),
    lastActivity: c["lastActivity"] ? String(c["lastActivity"]) : null,
    transactions: Number(c["transactions"] ?? 0),
    totalSpend: Number(c["totalSpend"] ?? 0),
    discountReceived: Number(c["discountReceived"] ?? 0),
    status: c["status"] === "inactive" ? "inactive" : "active",
    qrToken: c["qrToken"] ? String(c["qrToken"]) : undefined,
  };
}

function mapCustomerTransaction(raw: unknown): CustomerTransaction {
  const t = raw as Record<string, unknown>;
  return {
    id: String(t["id"] ?? ""),
    status: String(t["status"] ?? ""),
    amount: Number(t["amount"] ?? 0),
    discountPercent: Number(t["discountPercent"] ?? 0),
    discountAmount: Number(t["discountAmount"] ?? 0),
    netPayable: Number(t["netPayable"] ?? 0),
    fuel: t["fuel"] ? String(t["fuel"]) : undefined,
    litres: t["litres"] !== undefined && t["litres"] !== null ? Number(t["litres"]) : undefined,
    submittedAt: String(t["submittedAt"] ?? ""),
    resolvedAt: t["resolvedAt"] ? String(t["resolvedAt"]) : null,
    workerId: String(t["workerId"] ?? ""),
    workerName: t["workerName"] ? String(t["workerName"]) : null,
  };
}

function mapWorker(raw: unknown): Worker {
  const w = raw as Record<string, unknown>;
  const rawShift = String(w["shift"] ?? "Morning");
  const shift: Worker["shift"] =
    rawShift === "Evening" || rawShift === "Night" ? rawShift : "Morning";
  const rawStatus = String(w["status"] ?? "active");
  const status: Worker["status"] =
    rawStatus === "offline" || rawStatus === "suspended" ? rawStatus : "active";

  return {
    id: String(w["id"] ?? ""),
    name: String(w["name"] ?? ""),
    email: String(w["email"] ?? ""),
    phone: String(w["phone"] ?? ""),
    shift,
    status,
    joinedAt: String(w["joinedAt"] ?? ""),
    firstLoginAt: w["firstLoginAt"] ? String(w["firstLoginAt"]) : null,
    scans: Number(w["scans"] ?? 0),
    customersScanned: Number(w["customersScanned"] ?? 0),
    transactions: Number(w["transactions"] ?? 0),
    discountProcessed: Number(w["discountProcessed"] ?? 0),
    lastActivity: w["lastActivity"] ? String(w["lastActivity"]) : null,
  };
}

function mapWorkerTransaction(raw: unknown): WorkerTransaction {
  const t = raw as Record<string, unknown>;
  return {
    id: String(t["id"] ?? ""),
    status: String(t["status"] ?? ""),
    amount: Number(t["amount"] ?? 0),
    discountPercent: Number(t["discountPercent"] ?? 0),
    discountAmount: Number(t["discountAmount"] ?? 0),
    netPayable: Number(t["netPayable"] ?? 0),
    fuel: t["fuel"] ? String(t["fuel"]) : undefined,
    litres: t["litres"] !== undefined && t["litres"] !== null ? Number(t["litres"]) : undefined,
    submittedAt: String(t["submittedAt"] ?? ""),
    resolvedAt: t["resolvedAt"] ? String(t["resolvedAt"]) : null,
    customerId: String(t["customerId"] ?? ""),
    customerName: t["customerName"] ? String(t["customerName"]) : null,
  };
}

function mapAdminTransaction(raw: unknown): AdminTransaction {
  const t = raw as Record<string, unknown>;
  const rawFuel = t["fuel"] ? String(t["fuel"]) : undefined;
  const fuel =
    rawFuel === "Petrol" || rawFuel === "Diesel" || rawFuel === "CNG" ? rawFuel : undefined;

  const rawStatus = String(t["status"] ?? "pending");
  const status: AdminTransaction["status"] =
    rawStatus === "success" || rawStatus === "failed" ? rawStatus : "pending";

  return {
    id: String(t["id"] ?? ""),
    status,
    amount: Number(t["amount"] ?? 0),
    discountPercent: Number(t["discountPercent"] ?? 0),
    discountAmount: Number(t["discountAmount"] ?? 0),
    netPayable: Number(t["netPayable"] ?? 0),
    fuel,
    litres: t["litres"] !== undefined && t["litres"] !== null ? Number(t["litres"]) : undefined,
    failureReason: t["failureReason"] ? String(t["failureReason"]) : null,
    submittedAt: String(t["submittedAt"] ?? ""),
    resolvedAt: t["resolvedAt"] ? String(t["resolvedAt"]) : null,
    customerId: String(t["customerId"] ?? ""),
    customerName: String(t["customerName"] ?? ""),
    customerPhone: t["customerPhone"] ? String(t["customerPhone"]) : undefined,
    workerId: String(t["workerId"] ?? ""),
    workerName: String(t["workerName"] ?? ""),
    groupId: t["groupId"] ? String(t["groupId"]) : undefined,
    groupName: t["groupName"] ? String(t["groupName"]) : undefined,
    createdAt: t["createdAt"] ? String(t["createdAt"]) : undefined,
    updatedAt: t["updatedAt"] ? String(t["updatedAt"]) : undefined,
  };
}

function mapNotification(raw: unknown): Notification {
  const n = raw as Record<string, unknown>;
  const rawType = String(n["type"] ?? "system");
  const type: Notification["type"] =
    rawType === "registration" || rawType === "worker" || rawType === "group" ? rawType : "system";

  return {
    id: String(n["id"] ?? ""),
    type,
    title: String(n["title"] ?? ""),
    message: String(n["message"] ?? ""),
    read: Boolean(n["isRead"] ?? n["read"]),
    createdAt: String(n["createdAt"] ?? ""),
    customerId: n["customerId"] ? String(n["customerId"]) : undefined,
    workerId: n["workerId"] ? String(n["workerId"]) : undefined,
    readAt: n["readAt"] ? String(n["readAt"]) : null,
  };
}

function mapAuditLogEntry(raw: unknown): AuditLogEntry {
  const a = raw as Record<string, unknown>;
  return {
    id: String(a["id"] ?? ""),
    actorType: String(a["actorType"] ?? ""),
    actorId: a["actorId"] ? String(a["actorId"]) : null,
    actorName: a["actorName"] ? String(a["actorName"]) : null,
    action: String(a["action"] ?? ""),
    entityType: a["entityType"] ? String(a["entityType"]) : null,
    entityId: a["entityId"] ? String(a["entityId"]) : null,
    oldStatus: a["oldStatus"] ? String(a["oldStatus"]) : null,
    newStatus: a["newStatus"] ? String(a["newStatus"]) : null,
    reason: a["reason"] ? String(a["reason"]) : null,
    oldValue: (a["oldValue"] as Record<string, unknown> | null) ?? null,
    newValue: (a["newValue"] as Record<string, unknown> | null) ?? null,
    ipAddress: a["ipAddress"] ? String(a["ipAddress"]) : null,
    userAgent: a["userAgent"] ? String(a["userAgent"]) : null,
    createdAt: String(a["createdAt"] ?? ""),
  };
}

function mapAdminProfile(raw: unknown): AdminProfile {
  const p = raw as Record<string, unknown>;
  return {
    name: String(p["name"] ?? "Administrator"),
    email: String(p["email"] ?? ""),
    phone: String(p["phone"] ?? ""),
    role: String(p["role"] ?? "admin"),
    location: String(p["location"] ?? ""),
    joinedAt: String(p["joinedAt"] ?? ""),
    initials: String(p["initials"] ?? "AD"),
    avatarUrl: p["avatarUrl"] ? String(p["avatarUrl"]) : null,
  };
}

/* ---------- Groups API ---------- */

export const groupsApi = {
  list: async (): Promise<Group[]> => {
    const res = await apiRequest<{ groups: unknown[] }>("/admin/groups");
    return (res.groups || []).map(mapGroup);
  },

  create: async (data: {
    name: string;
    discountPercent: number;
    description?: string | null | undefined;
    active?: boolean | undefined;
  }): Promise<Group> => {
    const res = await apiRequest<{ group: unknown }>("/admin/groups", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return mapGroup(res.group);
  },

  update: async (
    id: string,
    data: {
      name?: string | undefined;
      discountPercent?: number | undefined;
      description?: string | null | undefined;
    },
  ): Promise<Group> => {
    const res = await apiRequest<{ group: unknown }>(`/admin/groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return mapGroup(res.group);
  },

  toggleActive: async (id: string): Promise<Group> => {
    const res = await apiRequest<{ group: unknown }>(`/admin/groups/${id}/toggle-active`, {
      method: "PATCH",
    });
    return mapGroup(res.group);
  },

  delete: async (id: string): Promise<{ message: string; reallocatedCustomers?: number }> => {
    return apiRequest<{ message: string; reallocatedCustomers?: number }>(`/admin/groups/${id}`, {
      method: "DELETE",
    });
  },
};

/* ---------- Customers API ---------- */

export const customersApi = {
  list: async (
    params: CustomerQueryParams = {},
  ): Promise<{ data: Customer[]; pagination: PaginationMeta }> => {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
    if (params.sort_by) searchParams.set("sort_by", params.sort_by);
    if (params.order) searchParams.set("order", params.order);
    if (params.q && params.q.trim()) searchParams.set("q", params.q.trim());
    if (params.status && params.status !== ("all" as string))
      searchParams.set("status", params.status);
    if (params.group_id && params.group_id !== "all") searchParams.set("group_id", params.group_id);

    const qs = searchParams.toString();
    const endpoint = `/admin/customers${qs ? `?${qs}` : ""}`;
    const res = await apiRequest<{ data: unknown[]; pagination: PaginationMeta }>(endpoint);

    return {
      data: (res.data || []).map(mapCustomer),
      pagination: res.pagination,
    };
  },

  getById: async (id: string): Promise<CustomerDetail> => {
    const res = await apiRequest<{ customer: unknown; recentTransactions: unknown[] }>(
      `/admin/customers/${id}`,
    );
    return {
      customer: mapCustomer(res.customer),
      recentTransactions: (res.recentTransactions || []).map(mapCustomerTransaction),
    };
  },

  create: async (data: {
    name: string;
    phone: string;
    email?: string | null | undefined;
    vehicle?: string | null | undefined;
    groupId?: string | undefined;
  }): Promise<Customer> => {
    const payload = {
      name: data.name.trim(),
      phone: normalizePhoneForApi(data.phone),
      email: data.email?.trim() || null,
      vehicle: data.vehicle?.trim() || null,
      groupId: data.groupId || undefined,
    };
    const res = await apiRequest<{ customer: unknown }>("/admin/customers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return mapCustomer(res.customer);
  },

  update: async (
    id: string,
    data: {
      name?: string | undefined;
      phone?: string | undefined;
      email?: string | null | undefined;
      vehicle?: string | null | undefined;
    },
  ): Promise<Customer> => {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload["name"] = data.name.trim();
    if (data.phone !== undefined) payload["phone"] = normalizePhoneForApi(data.phone);
    if (data.email !== undefined) payload["email"] = data.email?.trim() || null;
    if (data.vehicle !== undefined) payload["vehicle"] = data.vehicle?.trim() || null;

    const res = await apiRequest<{ customer: unknown }>(`/admin/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return mapCustomer(res.customer);
  },

  updateStatus: async (id: string, status: "active" | "inactive"): Promise<Customer> => {
    const res = await apiRequest<{ customer: unknown }>(`/admin/customers/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return mapCustomer(res.customer);
  },

  assignGroup: async (id: string, groupId: string): Promise<Customer> => {
    const res = await apiRequest<{ customer: unknown }>(`/admin/customers/${id}/group`, {
      method: "PATCH",
      body: JSON.stringify({ groupId }),
    });
    return mapCustomer(res.customer);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/admin/customers/${id}`, {
      method: "DELETE",
    });
  },
};

/* ---------- Workers API ---------- */

export const workersApi = {
  list: async (
    params: WorkerQueryParams = {},
  ): Promise<{ data: Worker[]; pagination: PaginationMeta }> => {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
    if (params.sort_by) searchParams.set("sort_by", params.sort_by);
    if (params.order) searchParams.set("order", params.order);
    if (params.q && params.q.trim()) searchParams.set("q", params.q.trim());
    if (params.status && params.status !== ("all" as string))
      searchParams.set("status", params.status);
    if (params.shift && params.shift !== ("all" as string)) searchParams.set("shift", params.shift);

    const qs = searchParams.toString();
    const endpoint = `/admin/workers${qs ? `?${qs}` : ""}`;
    const res = await apiRequest<{ data: unknown[]; pagination: PaginationMeta }>(endpoint);

    return {
      data: (res.data || []).map(mapWorker),
      pagination: res.pagination,
    };
  },

  getById: async (id: string): Promise<WorkerDetail> => {
    const res = await apiRequest<{ worker: unknown; recentTransactions: unknown[] }>(
      `/admin/workers/${id}`,
    );
    return {
      worker: mapWorker(res.worker),
      recentTransactions: (res.recentTransactions || []).map(mapWorkerTransaction),
    };
  },

  create: async (data: {
    name: string;
    phone: string;
    email: string;
    shift: "Morning" | "Evening" | "Night";
    status?: "active" | "offline" | "suspended" | undefined;
  }): Promise<Worker> => {
    const payload = {
      name: data.name.trim(),
      phone: normalizePhoneForApi(data.phone),
      email: data.email.trim(),
      shift: data.shift,
      status: data.status || "active",
    };
    const res = await apiRequest<{ worker: unknown }>("/admin/workers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return mapWorker(res.worker);
  },

  update: async (
    id: string,
    data: {
      name?: string | undefined;
      phone?: string | undefined;
      email?: string | undefined;
      shift?: "Morning" | "Evening" | "Night" | undefined;
    },
  ): Promise<Worker> => {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload["name"] = data.name.trim();
    if (data.phone !== undefined) payload["phone"] = normalizePhoneForApi(data.phone);
    if (data.email !== undefined) payload["email"] = data.email.trim();
    if (data.shift !== undefined) payload["shift"] = data.shift;

    const res = await apiRequest<{ worker: unknown }>(`/admin/workers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return mapWorker(res.worker);
  },

  updateStatus: async (id: string, status: "active" | "offline" | "suspended"): Promise<Worker> => {
    const res = await apiRequest<{ worker: unknown }>(`/admin/workers/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return mapWorker(res.worker);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/admin/workers/${id}`, {
      method: "DELETE",
    });
  },
};

/* ---------- Dashboard API ---------- */

export interface Overview {
  totalCustomers: number;
  totalWorkers: number;
  activeWorkers: number;
  totalGroups: number;
  totalTransactions: number;
  totalDiscount: number;
  totalRevenue: number;
  todayTransactions: number;
  todayDiscount: number;
  newRegistrations7d: number;
  activeCustomers: number;
  usedPumpCustomers: number;
  unassignedCustomers: number;
  avgDiscountPercent: number;
}

export const dashboardApi = {
  getOverview: async (): Promise<Overview> => {
    const res = await apiRequest<{ overview?: Record<string, unknown> } | Record<string, unknown>>(
      "/admin/dashboard/overview",
    );
    const ov = ("overview" in res && res.overview ? res.overview : res) as Record<string, unknown>;
    return {
      totalCustomers: Number(ov["totalCustomers"] ?? 0),
      totalWorkers: Number(ov["totalWorkers"] ?? 0),
      activeWorkers: Number(ov["activeWorkers"] ?? 0),
      totalGroups: Number(ov["totalGroups"] ?? 0),
      totalTransactions: Number(ov["totalTransactions"] ?? 0),
      totalDiscount: Number(ov["totalDiscount"] ?? 0),
      totalRevenue: Number(ov["totalRevenue"] ?? 0),
      todayTransactions: Number(ov["todayTransactions"] ?? 0),
      todayDiscount: Number(ov["todayDiscount"] ?? 0),
      newRegistrations7d: Number(ov["newRegistrations7d"] ?? 0),
      activeCustomers: Number(ov["activeCustomers"] ?? 0),
      usedPumpCustomers: Number(ov["usedPumpCustomers"] ?? 0),
      unassignedCustomers: Number(ov["unassignedCustomers"] ?? 0),
      avgDiscountPercent: Number(ov["avgDiscountPercent"] ?? 0),
    };
  },

  getSeries: async (days: number = 7): Promise<SeriesPoint[]> => {
    const res = await apiRequest<{ series: Array<Record<string, unknown>> }>(
      `/admin/dashboard/series?days=${days}`,
    );
    return (res.series || []).map((s) => ({
      date: String(s["date"] ?? ""),
      label: String(s["label"] ?? ""),
      transactions: Number(s["transactions"] ?? 0),
      discount: Number(s["discount"] ?? 0),
      registrations: Number(s["registrations"] ?? 0),
      revenue: Number(s["revenue"] ?? 0),
    }));
  },

  getWorkerActivity: async (): Promise<WorkerActivityItem[]> => {
    const res = await apiRequest<{ workers: Array<Record<string, unknown>> }>(
      "/admin/dashboard/worker-activity",
    );
    return (res.workers || []).map((w) => ({
      id: String(w["id"] ?? ""),
      name: String(w["name"] ?? ""),
      scans: Number(w["scans"] ?? 0),
      transactions: Number(w["transactions"] ?? 0),
    }));
  },

  getGroupDistribution: async (): Promise<GroupDistributionItem[]> => {
    const res = await apiRequest<{ groups: Array<Record<string, unknown>> }>(
      "/admin/dashboard/group-distribution",
    );
    return (res.groups || []).map((g) => ({
      id: String(g["id"] ?? ""),
      name: String(g["name"] ?? ""),
      discountPercent: Number(g["discountPercent"] ?? 0),
      active: Boolean(g["active"]),
      customers: Number(g["customers"] ?? 0),
      transactions: Number(g["transactions"] ?? 0),
      discountGenerated: Number(g["discountGenerated"] ?? 0),
    }));
  },
};

/* ---------- Reports API ---------- */

export const reportsApi = {
  getOverview: dashboardApi.getOverview,

  getSummary: async (
    category: "transactions" | "discount" | "customers" | "workers" | "groups",
    from?: string,
    to?: string,
  ): Promise<ReportsSummary> => {
    const searchParams = new URLSearchParams();
    searchParams.set("category", category);
    if (from) searchParams.set("from", from);
    if (to) searchParams.set("to", to);
    const res = await apiRequest<{
      category: "transactions" | "discount" | "customers" | "workers" | "groups";
      range: { from: string; to: string };
      metrics: MetricItem[];
      series: Array<Record<string, unknown>>;
    }>(`/admin/reports/summary?${searchParams.toString()}`);

    return {
      category: res.category,
      range: res.range,
      metrics: res.metrics || [],
      series: (res.series || []).map((s) => ({
        date: String(s["date"] ?? ""),
        label: String(s["label"] ?? ""),
        transactions: Number(s["transactions"] ?? 0),
        discount: Number(s["discount"] ?? 0),
        registrations: Number(s["registrations"] ?? 0),
        revenue: Number(s["revenue"] ?? 0),
      })),
    };
  },

  exportCsv: async (
    category: "transactions" | "discount" | "customers" | "workers" | "groups",
    from?: string,
    to?: string,
  ): Promise<void> => {
    const searchParams = new URLSearchParams();
    searchParams.set("category", category);
    if (from) searchParams.set("from", from);
    if (to) searchParams.set("to", to);
    searchParams.set("format", "csv");

    const blob = await apiRequestBlob(`/admin/reports/export?${searchParams.toString()}`);
    downloadBlob(`${category}-report.csv`, blob);
  },
};

/* ---------- Transactions API ---------- */

export const transactionsApi = {
  list: async (
    params: AdminTransactionQueryParams = {},
  ): Promise<{ data: AdminTransaction[]; pagination: PaginationMeta }> => {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
    if (params.sort_by) searchParams.set("sort_by", params.sort_by);
    if (params.order) searchParams.set("order", params.order);
    if (params.status) searchParams.set("status", params.status);
    if (params.customerId) searchParams.set("customerId", params.customerId);
    if (params.workerId) searchParams.set("workerId", params.workerId);
    if (params.groupId) searchParams.set("groupId", params.groupId);
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);

    const qs = searchParams.toString();
    const res = await apiRequest<{ data: unknown[]; pagination: PaginationMeta }>(
      `/admin/transactions${qs ? `?${qs}` : ""}`,
    );
    return {
      data: (res.data || []).map(mapAdminTransaction),
      pagination: res.pagination,
    };
  },

  getById: async (id: string): Promise<AdminTransactionDetail> => {
    const res = await apiRequest<{
      transaction: unknown;
      statusHistory: Array<Record<string, unknown>>;
    }>(`/admin/transactions/${id}`);
    return {
      transaction: mapAdminTransaction(res.transaction),
      statusHistory: (res.statusHistory || []).map((h) => ({
        id: String(h["id"] ?? ""),
        oldStatus: h["oldStatus"] ? String(h["oldStatus"]) : null,
        newStatus: String(h["newStatus"] ?? ""),
        actorType: String(h["actorType"] ?? ""),
        actorId: h["actorId"] ? String(h["actorId"]) : null,
        actorName: h["actorName"] ? String(h["actorName"]) : null,
        reason: h["reason"] ? String(h["reason"]) : null,
        createdAt: String(h["createdAt"] ?? ""),
      })),
    };
  },

  updateStatus: async (
    id: string,
    status: "success" | "failed",
    failureReason?: string | null | undefined,
  ): Promise<AdminTransaction> => {
    const body: { status: "success" | "failed"; failureReason?: string | null } = { status };
    if (status === "failed") {
      body.failureReason = failureReason ?? null;
    }
    const res = await apiRequest<{ transaction: unknown }>(`/admin/transactions/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return mapAdminTransaction(res.transaction);
  },
};

/* ---------- Notifications API ---------- */

export const notificationsApi = {
  list: async (
    params: NotificationQueryParams = {},
  ): Promise<{
    notifications: Notification[];
    unreadCount: number;
    pagination: PaginationMeta;
  }> => {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
    if (params.type) searchParams.set("type", params.type);
    if (params.unreadOnly !== undefined) searchParams.set("unreadOnly", String(params.unreadOnly));

    const qs = searchParams.toString();
    const res = await apiRequest<{
      notifications: unknown[];
      unreadCount: number;
      pagination: PaginationMeta;
    }>(`/admin/notifications${qs ? `?${qs}` : ""}`);

    return {
      notifications: (res.notifications || []).map(mapNotification),
      unreadCount: Number(res.unreadCount ?? 0),
      pagination: res.pagination,
    };
  },

  markRead: async (id: string): Promise<{ id: string; isRead: boolean; readAt: string | null }> => {
    return apiRequest<{ id: string; isRead: boolean; readAt: string | null }>(
      `/admin/notifications/${id}/read`,
      { method: "PATCH" },
    );
  },

  markAllRead: async (): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>("/admin/notifications/mark-all-read", {
      method: "POST",
    });
  },
};

/* ---------- Audit Logs API ---------- */

export const auditLogsApi = {
  list: async (
    params: AuditLogQueryParams = {},
  ): Promise<{ data: AuditLogEntry[]; pagination: PaginationMeta }> => {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
    if (params.action) searchParams.set("action", params.action);
    if (params.actorType) searchParams.set("actorType", params.actorType);
    if (params.actorId) searchParams.set("actorId", params.actorId);
    if (params.entityType) searchParams.set("entityType", params.entityType);
    if (params.entityId) searchParams.set("entityId", params.entityId);
    if (params.reason) searchParams.set("reason", params.reason);
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);

    const qs = searchParams.toString();
    const res = await apiRequest<{ data: unknown[]; pagination: PaginationMeta }>(
      `/admin/audit-logs${qs ? `?${qs}` : ""}`,
    );

    return {
      data: (res.data || []).map(mapAuditLogEntry),
      pagination: res.pagination,
    };
  },
};

/* ---------- Profile API ---------- */

export const profileApi = {
  get: async (): Promise<AdminProfile> => {
    const res = await apiRequest<unknown>("/admin/profile");
    return mapAdminProfile(res);
  },

  update: async (data: {
    name?: string | undefined;
    phone?: string | null | undefined;
    location?: string | null | undefined;
  }): Promise<AdminProfile> => {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload["name"] = data.name.trim();
    if (data.phone !== undefined) {
      payload["phone"] = data.phone ? normalizePhoneForApi(data.phone) : null;
    }
    if (data.location !== undefined) {
      payload["location"] = data.location?.trim() || null;
    }
    const res = await apiRequest<{ profile: unknown }>("/admin/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return mapAdminProfile(res.profile);
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>("/admin/profile/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

/* ---------- Global Search API ---------- */

export const searchApi = {
  globalSearch: async (q: string): Promise<GlobalSearchResult> => {
    const trimmed = q.trim();
    if (!trimmed) return { customers: [], workers: [] };
    const res = await apiRequest<{
      customers: Array<Record<string, unknown>>;
      workers: Array<Record<string, unknown>>;
    }>(`/admin/search?q=${encodeURIComponent(trimmed)}`);

    return {
      customers: (res.customers || []).map((c) => ({
        id: String(c["id"] ?? ""),
        name: String(c["name"] ?? ""),
        phone: String(c["phone"] ?? ""),
        email: c["email"] ? String(c["email"]) : null,
        status: (c["status"] as "active" | "inactive") || "active",
      })),
      workers: (res.workers || []).map((w) => ({
        id: String(w["id"] ?? ""),
        name: String(w["name"] ?? ""),
        phone: String(w["phone"] ?? ""),
        email: String(w["email"] ?? ""),
        status: (w["status"] as "active" | "offline" | "suspended") || "active",
      })),
    };
  },
};

/* ---------- formatting helpers ---------- */

export const formatCurrency = (value: number | string | null | undefined) =>
  `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;

export const formatNumber = (value: number | string | null | undefined) =>
  (Number(value) || 0).toLocaleString("en-IN");

export const formatDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const formatPhone = (value: string | null | undefined): string => {
  if (!value) return "—";
  const clean = value.replace(/\s+/g, "");
  const match10 = clean.match(/^(\+?91)?([6-9]\d{9})$/);
  if (match10 && match10[2]) {
    const d = match10[2];
    return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  }
  return value;
};

export const normalizePhoneForApi = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  return value.trim();
};

export const relativeDays = (value: string | null | undefined): string => {
  if (!value) return "Never";
  const now = new Date();
  const diff = Math.floor((now.getTime() - new Date(value).getTime()) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 30) return `${diff} days ago`;
  return `${Math.floor(diff / 30)} mo ago`;
};

export type RangeKey = "today" | "week" | "month" | "quarter" | "custom";

export function rangeBounds(range: RangeKey, from?: string, to?: string) {
  const now = new Date();
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  if (range === "week") start.setUTCDate(start.getUTCDate() - 6);
  if (range === "month") start.setUTCDate(start.getUTCDate() - 29);
  if (range === "quarter") start.setUTCDate(start.getUTCDate() - 89);
  if (range === "custom") {
    return {
      start: from ? new Date(`${from}T00:00:00.000Z`) : start,
      end: to ? new Date(`${to}T23:59:59.999Z`) : end,
    };
  }
  return { start, end };
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCsv(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]!);
  const body = rows.map((r) =>
    headers
      .map((h) => {
        const v = String(r[h] ?? "");
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      })
      .join(","),
  );
  const csv = [headers.join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(filename, blob);
}
