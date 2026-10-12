export const DEFAULT_GROUP_ID = "grp-default";
export type GroupId = string;

export interface Group {
  id: GroupId;
  name: string;
  discountPercent: number;
  description: string;
  active: boolean;
  createdAt: string;
  isDefault?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  groupId: GroupId;
  registeredAt: string;
  lastActivity: string | null;
  transactions: number;
  totalSpend: number;
  discountReceived: number;
  status: "active" | "inactive" | "pending";
  password?: string;
}

export interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
  shift: "Morning" | "Evening" | "Night";
  status: "active" | "offline" | "suspended";
  joinedAt: string;
  scans: number;
  customersScanned: number;
  transactions: number;
  discountProcessed: number;
  lastActivity: string;
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
  litres: number;
  fuel: "Petrol" | "Diesel" | "CNG";
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "registration" | "group" | "worker" | "system";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  customerId?: string;
}

export interface AdminProfile {
  name: string;
  email: string;
  phone: string;
  role: string;
  location: string;
  joinedAt: string;
  initials: string;
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
