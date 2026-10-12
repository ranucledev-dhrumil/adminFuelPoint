import type {
  AdminProfile,
  Customer,
  Group,
  Notification,
  Transaction,
  Worker,
} from "./types";
import { DEFAULT_GROUP_ID } from "./types";

/**
 * Deterministic mock data. Everything here is replaceable by real API calls —
 * see src/services/adminService.ts for the single access layer.
 */

// Seeded PRNG so server render and client render always agree.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const rand = rng(20260923);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;
const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

/** Fixed "today" keeps mock data stable across renders. */
export const TODAY = new Date("2026-09-23T10:00:00.000Z");

const dayMs = 86400000;
const iso = (daysAgo: number, hour = 9, minute = 15) => {
  const d = new Date(TODAY.getTime() - daysAgo * dayMs);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
};

export const groups: Group[] = [
  {
    id: DEFAULT_GROUP_ID,
    name: "Default / Customer",
    discountPercent: 0,
    description: "New registrations land here until an admin assigns a group.",
    active: true,
    createdAt: iso(400),
    isDefault: true,
  },
  {
    id: "grp-family",
    name: "Family",
    discountPercent: 2,
    description: "Owner family members and relatives.",
    active: true,
    createdAt: iso(360),
  },
  {
    id: "grp-friends",
    name: "Friends",
    discountPercent: 1,
    description: "Close friends and long-standing personal contacts.",
    active: true,
    createdAt: iso(352),
  },
  {
    id: "grp-employees",
    name: "Employees",
    discountPercent: 3,
    description: "Staff of the pump and partner businesses.",
    active: true,
    createdAt: iso(340),
  },
  {
    id: "grp-fleet",
    name: "Fleet Partners",
    discountPercent: 2.5,
    description: "Contracted logistics and taxi fleets.",
    active: true,
    createdAt: iso(120),
  },
  {
    id: "grp-legacy",
    name: "Festive 2025",
    discountPercent: 1.5,
    description: "Seasonal campaign group, currently paused.",
    active: false,
    createdAt: iso(300),
  },
];

const firstNames = [
  "Aarav","Vivaan","Diya","Ananya","Kabir","Meera","Rohan","Ishita","Arjun","Nisha",
  "Farhan","Sana","Vikram","Priya","Dev","Tara","Imran","Kavya","Rahul","Neha",
  "Yash","Simran","Aditya","Pooja","Manav","Ritika","Zoya","Karan","Lata","Omar",
];
const lastNames = [
  "Sharma","Patel","Nair","Iyer","Khan","Reddy","Gupta","Menon","Bose","Chopra",
  "Desai","Joshi","Rao","Verma","Sethi","Kulkarni","Bhat","Mehta",
];
const vehicles = [
  "Maruti Swift","Hyundai Creta","Honda City","Tata Nexon","Royal Enfield 350",
  "Toyota Innova","Mahindra Thar","TVS Jupiter","Kia Seltos","Ashok Leyland Truck",
];

const weightedGroup = () => {
  const r = rand();
  if (r < 0.14) return DEFAULT_GROUP_ID;
  if (r < 0.4) return "grp-family";
  if (r < 0.62) return "grp-friends";
  if (r < 0.82) return "grp-employees";
  if (r < 0.95) return "grp-fleet";
  return "grp-legacy";
};

export const workers: Worker[] = [
  "Suresh Kumar","Anita Deshmukh","Ravi Shankar","Pooja Bansal","Imtiaz Ali",
  "Deepak Yadav","Sneha Kulkarni","Manoj Pillai","Farida Sheikh","Naveen Rathore",
].map((name, i) => {
  const scans = between(120, 1450);
  const status = i === 8 ? "suspended" : i % 3 === 2 ? "offline" : "active";
  return {
    id: `WRK-${String(i + 1).padStart(3, "0")}`,
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@fuelpoint.in`,
    phone: `+91 9${between(100000000, 899999999)}`,
    shift: (["Morning", "Evening", "Night"] as const)[i % 3]!,
    status: status as Worker["status"],
    joinedAt: iso(between(60, 700)),
    scans,
    customersScanned: Math.round(scans * (0.55 + rand() * 0.3)),
    transactions: Math.round(scans * (0.8 + rand() * 0.18)),
    discountProcessed: Math.round(scans * between(9, 26)),
    lastActivity: iso(status === "active" ? 0 : between(1, 14), between(7, 21), between(0, 59)),
  };
});

export const customers: Customer[] = Array.from({ length: 96 }, (_, i) => {
  const name = `${pick(firstNames)} ${pick(lastNames)}`;
  const groupId = weightedGroup();
  const registeredDaysAgo = between(0, 320);
  const transactions = registeredDaysAgo < 3 ? between(0, 2) : between(1, 68);
  const group = groups.find((g) => g.id === groupId)!;
  const totalSpend = transactions * between(700, 3200);
  const status: Customer["status"] =
    groupId === DEFAULT_GROUP_ID && registeredDaysAgo < 6
      ? "pending"
      : transactions === 0 || registeredDaysAgo > 250
        ? "inactive"
        : "active";
  return {
    id: `CUS-${String(1000 + i)}`,
    name,
    phone: `+91 8${between(100000000, 899999999)}`,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}${i}@mail.com`,
    vehicle: pick(vehicles),
    groupId,
    registeredAt: iso(registeredDaysAgo, between(8, 20), between(0, 59)),
    lastActivity: transactions === 0 ? null : iso(between(0, 40), between(7, 22), between(0, 59)),
    transactions,
    totalSpend,
    discountReceived: Math.round((totalSpend * group.discountPercent) / 100),
    status,
  };
});

const fuels = ["Petrol", "Diesel", "CNG"] as const;

export const transactions: Transaction[] = Array.from({ length: 420 }, (_, i) => {
  const customer = pick(customers.filter((c) => c.transactions > 0));
  const worker = pick(workers);
  const group = groups.find((g) => g.id === customer.groupId)!;
  const amount = between(450, 4800);
  const daysAgo = between(0, 89);
  return {
    id: `TXN-${String(90000 + i)}`,
    customerId: customer.id,
    customerName: customer.name,
    workerId: worker.id,
    workerName: worker.name,
    groupId: group.id,
    amount,
    discountPercent: group.discountPercent,
    discountAmount: Math.round((amount * group.discountPercent) / 100),
    litres: Math.round((amount / 104) * 10) / 10,
    fuel: pick([...fuels]),
    createdAt: iso(daysAgo, between(6, 23), between(0, 59)),
  };
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const recentRegistrations = [...customers]
  .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
  .slice(0, 6);

const notificationSeed: Notification[] = [
  ...recentRegistrations.map((c, i) => ({
    id: `NTF-R${i}`,
    type: "registration" as const,
    title: "New customer registration — group assignment required",
    message: `${c.name} (${c.phone}) registered and is currently in Default / Unassigned.`,
    createdAt: c.registeredAt,
    read: i > 3,
    customerId: c.id,
  })),
  {
    id: "NTF-W1",
    type: "worker",
    title: "Worker account suspended",
    message: "Farida Sheikh was suspended after repeated scan mismatches.",
    createdAt: iso(2, 11, 30),
    read: false,
  },
  {
    id: "NTF-G1",
    type: "group",
    title: "Discount updated",
    message: "Fleet Partners discount changed from 2% to 2.5%.",
    createdAt: iso(4, 16, 10),
    read: true,
  },
  {
    id: "NTF-S1",
    type: "system",
    title: "Monthly discount report ready",
    message: "August discount reconciliation is available in Reports.",
    createdAt: iso(6, 8, 5),
    read: true,
  },
];

export const notifications: Notification[] = [...notificationSeed].sort((a, b) =>
  b.createdAt.localeCompare(a.createdAt),
);

export const adminProfile: AdminProfile = {
  name: "Rajesh Menon",
  email: "rajesh.menon@fuelpoint.in",
  phone: "+91 98204 41120",
  role: "Super Admin",
  location: "Pune, Maharashtra",
  joinedAt: iso(720),
  initials: "RM",
};
