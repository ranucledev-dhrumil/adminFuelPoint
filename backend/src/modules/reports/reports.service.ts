import type { Response } from "express";
import { Decimal } from "decimal.js";
import { BadRequestError } from "../../common/errors/app-error.js";
import {
  getTodayIstBoundaries,
  getIstDayBuckets,
  parseDateBoundary,
} from "../../common/utils/date.js";
import { reportsRepository } from "./reports.repository.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type ReportCategory = "transactions" | "discount" | "customers" | "workers" | "groups";

export interface MetricItem {
  label: string;
  value: string | number;
}

export interface SeriesPoint {
  date: string;
  label: string;
  transactions: number;
  discount: string;
  registrations: number;
  revenue: string;
}

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class ReportsService {
  async getDashboardOverview() {
    const { start: todayStart, end: todayEnd } = getTodayIstBoundaries();
    const m = await reportsRepository.getOverviewMetrics(todayStart, todayEnd);

    const totalRevenue = new Decimal(m.total_revenue || 0);
    const totalDiscount = new Decimal(m.total_discount || 0);
    const avgDiscountPercent = totalRevenue.greaterThan(0)
      ? totalDiscount.dividedBy(totalRevenue).times(100).toFixed(2)
      : "0.00";

    return {
      totalCustomers: Number(m.total_customers),
      totalWorkers: Number(m.total_workers),
      activeWorkers: Number(m.active_workers),
      totalGroups: Number(m.total_groups),
      totalTransactions: Number(m.total_transactions),
      totalDiscount: totalDiscount.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      todayTransactions: Number(m.today_transactions),
      todayDiscount: new Decimal(m.today_discount || 0).toFixed(2),
      newRegistrations7d: Number(m.new_registrations_7d),
      activeCustomers: Number(m.active_customers),
      usedPumpCustomers: Number(m.used_pump_customers),
      unassignedCustomers: Number(m.unassigned_customers),
      avgDiscountPercent,
    };
  }

  async getDashboardSeries(daysParam: number = 7) {
    const days = Number(daysParam) || 7;
    if (![7, 30, 90].includes(days)) {
      throw new BadRequestError("Invalid days parameter. Must be 7, 30, or 90.", "INVALID_DAYS");
    }

    const buckets = getIstDayBuckets(days);
    const startRange = buckets[0].start;
    const endRange = buckets[buckets.length - 1].end;

    const [txAggs, regAggs] = await Promise.all([
      reportsRepository.getTransactionDailyAggs(startRange, endRange),
      reportsRepository.getCustomerRegistrationDailyAggs(startRange, endRange),
    ]);

    const txMap = new Map(txAggs.map((t) => [t.day_key, t]));
    const regMap = new Map(regAggs.map((r) => [r.day_key, r]));

    const series: SeriesPoint[] = buckets.map((b) => {
      const tx = txMap.get(b.date);
      const reg = regMap.get(b.date);

      return {
        date: b.date,
        label: b.label,
        transactions: tx ? Number(tx.transactions) : 0,
        discount: tx ? new Decimal(tx.discount).toFixed(2) : "0.00",
        registrations: reg ? Number(reg.registrations) : 0,
        revenue: tx ? new Decimal(tx.revenue).toFixed(2) : "0.00",
      };
    });

    return { series };
  }

  async getWorkerActivity() {
    const rows = await reportsRepository.getWorkerActivity();
    return {
      workers: rows.map((w) => ({
        id: w.id,
        name: w.name,
        scans: Number(w.scans),
        transactions: Number(w.transactions),
      })),
    };
  }

  async getGroupDistribution() {
    const rows = await reportsRepository.getGroupDistribution();
    return {
      groups: rows.map((g) => ({
        id: g.id,
        name: g.name,
        discountPercent: new Decimal(g.discount_percent).toFixed(2),
        active: Boolean(g.active),
        customers: Number(g.customers),
        transactions: Number(g.transactions),
        discountGenerated: new Decimal(g.discount_generated).toFixed(2),
      })),
    };
  }

  async getReportsSummary(category: ReportCategory, fromStr?: string, toStr?: string) {
    const validCategories = ["transactions", "discount", "customers", "workers", "groups"];
    if (!validCategories.includes(category)) {
      throw new BadRequestError("Invalid report category.", "INVALID_CATEGORY");
    }

    // Default range to last 30 days if not provided
    const today = getTodayIstBoundaries();
    const fromDate = fromStr
      ? parseDateBoundary(fromStr, "start")
      : new Date(today.end.getTime() - 29 * 86400000);
    const toDate = toStr ? parseDateBoundary(toStr, "end") : today.end;

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestError(
        "Invalid date range: 'from' must be before 'to'.",
        "INVALID_DATE_RANGE",
      );
    }

    // Calculate series for the range (bounded to 90 days)
    const rangeDays = Math.max(
      1,
      Math.min(90, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1),
    );
    const buckets = getIstDayBuckets(rangeDays, toDate);
    const seriesStart = buckets[0].start;
    const seriesEnd = buckets[buckets.length - 1].end;

    const [txAggs, regAggs, overviewRaw] = await Promise.all([
      reportsRepository.getTransactionDailyAggs(seriesStart, seriesEnd),
      reportsRepository.getCustomerRegistrationDailyAggs(seriesStart, seriesEnd),
      reportsRepository.getOverviewMetrics(today.start, today.end),
    ]);

    const txMap = new Map(txAggs.map((t) => [t.day_key, t]));
    const regMap = new Map(regAggs.map((r) => [r.day_key, r]));

    const series: SeriesPoint[] = buckets.map((b) => {
      const tx = txMap.get(b.date);
      const reg = regMap.get(b.date);
      return {
        date: b.date,
        label: b.label,
        transactions: tx ? Number(tx.transactions) : 0,
        discount: tx ? new Decimal(tx.discount).toFixed(2) : "0.00",
        registrations: reg ? Number(reg.registrations) : 0,
        revenue: tx ? new Decimal(tx.revenue).toFixed(2) : "0.00",
      };
    });

    let metrics: MetricItem[] = [];

    if (category === "transactions") {
      const agg = await reportsRepository.getTransactionsSummaryMetrics(fromDate, toDate);
      const txCount = Number(agg.count || 0);
      const revenue = new Decimal(agg.revenue || 0);
      const litres = new Decimal(agg.litres || 0);
      const avgTicket = txCount > 0 ? revenue.dividedBy(txCount).toFixed(2) : "0.00";

      metrics = [
        { label: "Transactions", value: txCount },
        { label: "Revenue", value: revenue.toFixed(2) },
        { label: "Litres dispensed", value: litres.toFixed(2) },
        { label: "Avg ticket", value: avgTicket },
      ];
    } else if (category === "discount") {
      const agg = await reportsRepository.getTransactionsSummaryMetrics(fromDate, toDate);
      const txCount = Number(agg.count || 0);
      const revenue = new Decimal(agg.revenue || 0);
      const discount = new Decimal(agg.discount || 0);
      const discountedScans = Number(agg.discounted_scans || 0);
      const effectiveRate = revenue.greaterThan(0)
        ? `${discount.dividedBy(revenue).times(100).toFixed(2)}%`
        : "0.00%";
      const avgDiscount = txCount > 0 ? discount.dividedBy(txCount).toFixed(2) : "0.00";

      metrics = [
        { label: "Discount given", value: discount.toFixed(2) },
        { label: "Effective rate", value: effectiveRate },
        { label: "Discounted scans", value: discountedScans },
        { label: "Avg discount/scan", value: avgDiscount },
      ];
    } else if (category === "customers") {
      const newRegs = await reportsRepository.getCustomerRegistrationsCount(fromDate, toDate);
      metrics = [
        { label: "New registrations", value: newRegs },
        { label: "Total customers", value: Number(overviewRaw.total_customers) },
        { label: "Active", value: Number(overviewRaw.active_customers) },
        { label: "Unassigned", value: Number(overviewRaw.unassigned_customers) },
      ];
    } else if (category === "workers") {
      const scansInRange = await reportsRepository.getWorkerScansCount(fromDate, toDate);
      const agg = await reportsRepository.getTransactionsSummaryMetrics(fromDate, toDate);
      metrics = [
        { label: "Workers", value: Number(overviewRaw.total_workers) },
        { label: "Active", value: Number(overviewRaw.active_workers) },
        { label: "Scans in range", value: scansInRange },
        { label: "Discount processed", value: new Decimal(agg.discount || 0).toFixed(2) },
      ];
    } else if (category === "groups") {
      const agg = await reportsRepository.getTransactionsSummaryMetrics(fromDate, toDate);
      const totalCust = Number(overviewRaw.total_customers);
      const unassignedCust = Number(overviewRaw.unassigned_customers);
      metrics = [
        { label: "Groups", value: Number(overviewRaw.total_groups) },
        { label: "Active groups", value: Number(overviewRaw.total_groups) },
        { label: "Group discount", value: new Decimal(agg.discount || 0).toFixed(2) },
        { label: "Grouped customers", value: Math.max(0, totalCust - unassignedCust) },
      ];
    }

    return {
      category,
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      metrics,
      series,
    };
  }

  async exportCsvReport(
    category: ReportCategory,
    fromStr: string | undefined,
    toStr: string | undefined,
    res: Response,
  ): Promise<void> {
    const validCategories = ["transactions", "discount", "customers", "workers", "groups"];
    if (!validCategories.includes(category)) {
      throw new BadRequestError("Invalid report category for export.", "INVALID_CATEGORY");
    }

    const today = getTodayIstBoundaries();
    const fromDate = fromStr
      ? parseDateBoundary(fromStr, "start")
      : new Date(today.end.getTime() - 29 * 86400000);
    const toDate = toStr ? parseDateBoundary(toStr, "end") : today.end;

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestError("Invalid date range for export.", "INVALID_DATE_RANGE");
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${category}-report.csv"`);
    res.setHeader("Transfer-Encoding", "chunked");

    if (category === "transactions" || category === "discount") {
      const rows = await reportsRepository.getExportTransactions(fromDate, toDate);
      res.write("ID,Date,Customer,Worker,Fuel,Litres,Amount,DiscountPercent,Discount\n");
      for (const r of rows) {
        const line =
          [
            escapeCsvField(r.id),
            escapeCsvField(
              r.submitted_at instanceof Date ? r.submitted_at.toISOString() : r.submitted_at,
            ),
            escapeCsvField(r.customer_name),
            escapeCsvField(r.worker_name),
            escapeCsvField(r.fuel_type || ""),
            escapeCsvField(r.litres ? new Decimal(r.litres).toFixed(2) : ""),
            escapeCsvField(new Decimal(r.amount).toFixed(2)),
            escapeCsvField(new Decimal(r.discount_percent).toFixed(2)),
            escapeCsvField(new Decimal(r.discount_amount).toFixed(2)),
          ].join(",") + "\n";
        res.write(line);
      }
    } else if (category === "customers") {
      const rows = await reportsRepository.getExportCustomers(fromDate, toDate);
      res.write("ID,Name,Phone,Group,Registered,Transactions,Discount\n");
      for (const r of rows) {
        const line =
          [
            escapeCsvField(r.id),
            escapeCsvField(r.name),
            escapeCsvField(r.phone),
            escapeCsvField(r.group_name || "Standard (Default)"),
            escapeCsvField(
              r.registered_at instanceof Date ? r.registered_at.toISOString() : r.registered_at,
            ),
            escapeCsvField(r.transactions),
            escapeCsvField(new Decimal(r.discount_received).toFixed(2)),
          ].join(",") + "\n";
        res.write(line);
      }
    } else if (category === "workers") {
      const rows = await reportsRepository.getExportWorkers();
      res.write("ID,Name,Status,Scans,Transactions,DiscountProcessed,LastActivity\n");
      for (const r of rows) {
        const line =
          [
            escapeCsvField(r.id),
            escapeCsvField(r.name),
            escapeCsvField(r.status),
            escapeCsvField(r.scans),
            escapeCsvField(r.transactions),
            escapeCsvField(new Decimal(r.discount_processed).toFixed(2)),
            escapeCsvField(
              r.last_activity_at instanceof Date
                ? r.last_activity_at.toISOString()
                : r.last_activity_at || "",
            ),
          ].join(",") + "\n";
        res.write(line);
      }
    } else if (category === "groups") {
      const rows = await reportsRepository.getGroupDistribution();
      res.write("Group,DiscountPercent,Customers,Transactions,DiscountGenerated\n");
      for (const r of rows) {
        const line =
          [
            escapeCsvField(r.name),
            escapeCsvField(new Decimal(r.discount_percent).toFixed(2)),
            escapeCsvField(r.customers),
            escapeCsvField(r.transactions),
            escapeCsvField(new Decimal(r.discount_generated).toFixed(2)),
          ].join(",") + "\n";
        res.write(line);
      }
    }

    res.end();
  }

  async globalSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) {
      throw new BadRequestError("Search query is required.", "EMPTY_SEARCH_QUERY");
    }

    const [customers, workers] = await Promise.all([
      reportsRepository.searchCustomers(trimmed),
      reportsRepository.searchWorkers(trimmed),
    ]);

    return {
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        status: c.status,
      })),
      workers: workers.map((w) => ({
        id: w.id,
        name: w.name,
        phone: w.phone,
        email: w.email,
        status: w.status,
      })),
    };
  }
}

export const reportsService = new ReportsService();
