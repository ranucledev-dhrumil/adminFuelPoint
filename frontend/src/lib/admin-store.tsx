import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { adminService, DEFAULT_GROUP_ID } from "@/services/adminService";
import type { AdminProfile, Customer, Group, Notification, Transaction, Worker } from "@/services/types";

interface AdminState {
  authReady: boolean;
  authed: boolean;
  login: (email: string, remember?: boolean) => void;
  logout: () => void;
  profile: AdminProfile;
  updateProfile: (patch: Partial<AdminProfile>) => void;
  customers: Customer[];
  workers: Worker[];
  groups: Group[];
  transactions: Transaction[];
  notifications: Notification[];
  unreadCount: number;
  assignCustomerGroup: (customerId: string, groupId: string) => void;
  saveGroup: (group: Omit<Group, "createdAt"> & { createdAt?: string }) => void;
  deleteGroup: (groupId: string) => void;
  toggleGroupActive: (groupId: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  saveCustomer: (customer: Customer) => void;
  deleteCustomer: (customerId: string) => void;
  saveWorker: (worker: Worker) => void;
  deleteWorker: (workerId: string) => void;
}

const AdminContext = createContext<AdminState | null>(null);

const AUTH_KEY = "fuelpoint-admin-authed";

export function AdminProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [profile, setProfile] = useState<AdminProfile>(() => adminService.getProfile());
  const [customers, setCustomers] = useState<Customer[]>(() => adminService.getCustomers());
  const [groups, setGroups] = useState<Group[]>(() => adminService.getGroups());
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    adminService.getNotifications(),
  );
  const [workers, setWorkers] = useState<Worker[]>(() => adminService.getWorkers());
  const transactions = useMemo(() => adminService.getTransactions(), []);

  // Restore the session after a page refresh (client-side only).
  useEffect(() => {
    if (sessionStorage.getItem(AUTH_KEY) === "1") setAuthed(true);
    setAuthReady(true);
  }, []);

  const login = useCallback((email: string, remember: boolean = true) => {
    setAuthed(true);
    setProfile((p) => ({ ...p, email: email || p.email }));
    if (typeof window !== "undefined") {
      if (remember) {
        sessionStorage.setItem(AUTH_KEY, "1");
      } else {
        sessionStorage.removeItem(AUTH_KEY);
      }
    }
  }, []);

  const logout = useCallback(() => {
    setAuthed(false);
    if (typeof window !== "undefined") sessionStorage.removeItem(AUTH_KEY);
  }, []);

  const assignCustomerGroup = useCallback(
    (customerId: string, groupId: string) => {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id !== customerId) return c;
          const g = groups.find((x) => x.id === groupId);
          return {
            ...c,
            groupId,
            status: groupId === DEFAULT_GROUP_ID ? c.status : c.transactions > 0 ? "active" : c.status,
            discountReceived: Math.round((c.totalSpend * (g?.discountPercent ?? 0)) / 100),
          };
        }),
      );
      setNotifications((prev) =>
        prev.map((n) => (n.customerId === customerId ? { ...n, read: true } : n)),
      );
    },
    [groups],
  );

  const saveGroup: AdminState["saveGroup"] = useCallback((group) => {
    setGroups((prev) => {
      const exists = prev.some((g) => g.id === group.id);
      if (exists) return prev.map((g) => (g.id === group.id ? { ...g, ...group } : g));
      return [...prev, { ...group, createdAt: group.createdAt ?? new Date().toISOString() }];
    });
  }, []);

  const deleteGroup = useCallback((groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setCustomers((prev) =>
      prev.map((c) =>
        c.groupId === groupId ? { ...c, groupId: DEFAULT_GROUP_ID, discountReceived: 0 } : c,
      ),
    );
  }, []);

  const toggleGroupActive = useCallback((groupId: string) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, active: !g.active } : g)));
  }, []);

  const saveCustomer = useCallback((customer: Customer) => {
    setCustomers((prev) => {
      const exists = prev.some((c) => c.id === customer.id);
      if (exists) return prev.map((c) => (c.id === customer.id ? customer : c));
      return [...prev, customer];
    });
  }, []);

  const deleteCustomer = useCallback((customerId: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
  }, []);

  const saveWorker = useCallback((worker: Worker) => {
    setWorkers((prev) => {
      const exists = prev.some((w) => w.id === worker.id);
      if (exists) return prev.map((w) => (w.id === worker.id ? worker : w));
      return [...prev, worker];
    });
  }, []);

  const deleteWorker = useCallback((workerId: string) => {
    setWorkers((prev) => prev.filter((w) => w.id !== workerId));
  }, []);

  const value: AdminState = {
    authReady,
    authed,
    login,
    logout,
    profile,
    updateProfile: (patch) => setProfile((p) => ({ ...p, ...patch })),
    customers,
    workers,
    groups,
    transactions,
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    assignCustomerGroup,
    saveGroup,
    deleteGroup,
    toggleGroupActive,
    markRead: (id) =>
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))),
    markAllRead: () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
    saveCustomer,
    deleteCustomer,
    saveWorker,
    deleteWorker,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}
