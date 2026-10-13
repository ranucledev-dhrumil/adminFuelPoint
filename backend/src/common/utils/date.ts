/**
 * Date utility for parsing date filter boundaries and day buckets in Asia/Kolkata (IST, UTC+5:30).
 */

export function parseDateBoundary(dateStr: string, boundary: "start" | "end"): Date {
  const trimmed = dateStr.trim();
  const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (ymdRegex.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    if (boundary === "start") {
      // 00:00:00.000 IST -> UTC is (hour - 5, min - 30)
      return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 5.5 * 3600 * 1000);
    } else {
      // 23:59:59.999 IST -> UTC is (23:59:59.999 - 5.5 hours)
      return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - 5.5 * 3600 * 1000);
    }
  }
  return new Date(trimmed);
}

export function getTodayIstBoundaries(referenceDate: Date = new Date()): {
  start: Date;
  end: Date;
  todayKey: string;
} {
  const istOffset = 5.5 * 3600 * 1000;
  const istNow = new Date(referenceDate.getTime() + istOffset);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();

  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - istOffset);
  const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - istOffset);
  const todayKey = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return { start, end, todayKey };
}

export interface DayBucket {
  date: string;
  label: string;
  start: Date;
  end: Date;
}

export function getIstDayBuckets(days: number, referenceDate: Date = new Date()): DayBucket[] {
  const istOffset = 5.5 * 3600 * 1000;
  const istNow = new Date(referenceDate.getTime() + istOffset);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();

  const buckets: DayBucket[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const targetDay = new Date(Date.UTC(y, m, d - i, 0, 0, 0, 0));
    const ty = targetDay.getUTCFullYear();
    const tm = targetDay.getUTCMonth();
    const td = targetDay.getUTCDate();

    const dateKey = `${ty}-${String(tm + 1).padStart(2, "0")}-${String(td).padStart(2, "0")}`;
    const start = new Date(Date.UTC(ty, tm, td, 0, 0, 0, 0) - istOffset);
    const end = new Date(Date.UTC(ty, tm, td, 23, 59, 59, 999) - istOffset);

    const labelDate = new Date(Date.UTC(ty, tm, td, 12, 0, 0, 0));
    const label = labelDate.toLocaleDateString("en-IN", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
    });

    buckets.push({
      date: dateKey,
      label,
      start,
      end,
    });
  }

  return buckets;
}
