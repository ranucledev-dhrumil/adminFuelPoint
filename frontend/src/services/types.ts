export const DEFAULT_GROUP_ID = "00000000-0000-0000-0000-000000000001";
export type GroupId = string;

export interface Group {
  id: GroupId;
  name: string;
  discountPercent: number;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt?: string | undefined;
  isDefault?: boolean | undefined;
  customerCount?: number | undefined;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  vehicle: string | null;
  groupId: GroupId;
  groupName?: string | undefined;
  registeredAt: string;
  lastActivity: string | null;
  transactions: number;
  totalSpend: number;
  discountReceived: number;
  status: "active" | "inactive";
  qrToken?: string | undefined;
}

export interface CustomerTransaction {
  id: string;
  status: string;
  amount: number;
  discountPercent: number;
  discountAmount: number;
  netPayable: number;
  fuel?: string | undefined;
  litres?: number | undefined;
  submittedAt: string;
  resolvedAt: string | null;
  workerId: string;
  workerName: string | null;
}

export interface CustomerDetail {
  customer: Customer & {
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
  };
  recentTransactions: CustomerTransaction[];
}

export interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string;
  shift: "Morning" | "Evening" | "Night";
  status: "active" | "offline" | "suspended";
  joinedAt: string;
  firstLoginAt?: string | null | undefined;
  scans: number;
  customersScanned: number;
  transactions: number;
  discountProcessed: number;
  lastActivity: string | null;
}

export interface WorkerTransaction {
  id: string;
  status: string;
  amount: number;
  discountPercent: number;
  discountAmount: number;
  netPayable: number;
  fuel?: string | undefined;
  litres?: number | undefined;
  submittedAt: string;
  resolvedAt: string | null;
  customerId: string;
  customerName: string | null;
}

export interface WorkerDetail {
  worker: Worker & {
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
  };
  recentTransactions: WorkerTransaction[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CustomerQueryParams {
  page?: number | undefined;
  limit?: number | undefined;
  sort_by?:
    | "name"
    | "registeredAt"
    | "lastActivity"
    | "transactions"
    | "totalSpend"
    | "discountReceived"
    | "status"
    | undefined;
  order?: "asc" | "desc" | undefined;
  q?: string | undefined;
  status?: "active" | "inactive" | undefined;
  group_id?: string | undefined;
}

export interface WorkerQueryParams {
  page?: number | undefined;
  limit?: number | undefined;
  sort_by?:
    | "name"
    | "joinedAt"
    | "lastActivity"
    | "scans"
    | "transactions"
    | "customersScanned"
    | "discountProcessed"
    | "status"
    | "shift"
    | undefined;
  order?: "asc" | "desc" | undefined;
  q?: string | undefined;
  status?: "active" | "offline" | "suspended" | undefined;
  shift?: "Morning" | "Evening" | "Night" | undefined;
}

export interface Transaction {
  id: string;
  customerId: string;
  customerName: string;
  workerId: string;
  workerName: string;
  groupId: GroupId;
  amount: number;
  discountPercent: number;
  discountAmount: number;
  litres?: number | undefined;
  fuel?: "Petrol" | "Diesel" | "CNG" | undefined;
  createdAt: string;
}

export interface AdminTransaction {
  id: string;
  status: "pending" | "success" | "failed";
  amount: number;
  discountPercent: number;
  discountAmount: number;
  netPayable: number;
  fuel?: "Petrol" | "Diesel" | "CNG" | undefined;
  litres?: number | undefined;
  failureReason?: string | null | undefined;
  submittedAt: string;
  resolvedAt?: string | null | undefined;
  customerId: string;
  customerName: string;
  customerPhone?: string | undefined;
  workerId: string;
  workerName: string;
  groupId?: string | undefined;
  groupName?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface AdminTransactionStatusHistory {
  id: string;
  oldStatus: string | null;
  newStatus: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
}

export interface AdminTransactionDetail {
  transaction: AdminTransaction;
  statusHistory: AdminTransactionStatusHistory[];
}

export interface AdminTransactionQueryParams {
  page?: number | undefined;
  limit?: number | undefined;
  sort_by?: "submitted_at" | "amount" | "discount_amount" | "status" | undefined;
  order?: "asc" | "desc" | undefined;
  status?: "pending" | "success" | "failed" | undefined;
  customerId?: string | undefined;
  workerId?: string | undefined;
  groupId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export interface Notification {
  id: string;
  type: "registration" | "group" | "worker" | "system";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  customerId?: string | undefined;
  workerId?: string | undefined;
  readAt?: string | null | undefined;
}

export interface NotificationQueryParams {
  page?: number | undefined;
  limit?: number | undefined;
  type?: "registration" | "worker" | undefined;
  unreadOnly?: boolean | string | undefined;
}

export interface AdminProfile {
  name: string;
  email: string;
  phone: string;
  role: string;
  location: string;
  joinedAt: string;
  initials: string;
  avatarUrl?: string | null | undefined;
}

export interface SeriesPoint {
  [key: string]: string | number;
  date: string;
  label: string;
  transactions: number;
  discount: number;
  registrations: number;
  revenue: number;
}

export interface MetricItem {
  label: string;
  value: string | number;
}

export interface ReportsSummary {
  category: "transactions" | "discount" | "customers" | "workers" | "groups";
  range: {
    from: string;
    to: string;
  };
  metrics: MetricItem[];
  series: SeriesPoint[];
}

export interface WorkerActivityItem {
  id: string;
  name: string;
  scans: number;
  transactions: number;
}

export interface GroupDistributionItem {
  id: string;
  name: string;
  discountPercent: number;
  active: boolean;
  customers: number;
  transactions: number;
  discountGenerated: number;
}

export interface AuditLogEntry {
  id: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  oldStatus: string | null;
  newStatus: string | null;
  reason: string | null;
  oldValue?: Record<string, unknown> | null | undefined;
  newValue?: Record<string, unknown> | null | undefined;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogQueryParams {
  page?: number | undefined;
  limit?: number | undefined;
  action?: string | undefined;
  actorType?: "admin" | "worker" | "customer" | "system" | undefined;
  actorId?: string | undefined;
  entityType?: "customer" | "worker" | "group" | "transaction" | "admin_user" | undefined;
  entityId?: string | undefined;
  reason?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export interface GlobalSearchResult {
  customers: Array<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    status: "active" | "inactive";
  }>;
  workers: Array<{
    id: string;
    name: string;
    phone: string;
    email: string;
    status: "active" | "offline" | "suspended";
  }>;
}
