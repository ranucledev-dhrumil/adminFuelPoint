/**
 * Date utility for parsing date filter boundaries in Asia/Kolkata (IST, UTC+5:30).
 *
 * If the input is YYYY-MM-DD:
 *   - 'start' boundary: 00:00:00.000 IST (UTC - 5h 30m)
 *   - 'end' boundary: 23:59:59.999 IST (UTC + 18h 29m 59.999s)
 * If the input is a full ISO timestamp string, parses directly.
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
