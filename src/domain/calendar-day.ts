export type CalendarDayStatus = "empty" | "valid" | "invalid" | "future";

export interface CalendarDayResult {
  text: string;
  value: string;
  status: CalendarDayStatus;
  days?: number;
}

function parseCalendarDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;
  const timestamp = Date.UTC(year, month - 1, day);
  const checked = new Date(timestamp);
  if (
    checked.getUTCFullYear() !== year ||
    checked.getUTCMonth() !== month - 1 ||
    checked.getUTCDate() !== day
  ) {
    return Number.NaN;
  }
  return timestamp;
}

function localTodayTimestamp(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

export function calculatePostoperativeDay(
  surgeryDate: string,
  now: Date,
): CalendarDayResult {
  const surgeryTimestamp = parseCalendarDay(surgeryDate);
  if (surgeryTimestamp === null) {
    return { text: "POD —", value: "", status: "empty" };
  }
  if (Number.isNaN(surgeryTimestamp)) {
    return { text: "日期錯誤", value: "", status: "invalid" };
  }
  const days = Math.round((localTodayTimestamp(now) - surgeryTimestamp) / 86_400_000);
  if (days < 0) {
    return { text: "手術日在未來", value: "", status: "future" };
  }
  return { text: `POD ${days}`, value: `POD ${days}`, status: "valid", days };
}

export function calculateElapsedDay(
  date: string,
  now: Date,
  prefix = "距今",
): CalendarDayResult {
  const timestamp = parseCalendarDay(date);
  if (timestamp === null) {
    return { text: `${prefix} —`, value: "", status: "empty" };
  }
  if (Number.isNaN(timestamp)) {
    return { text: "日期錯誤", value: "", status: "invalid" };
  }
  const days = Math.round((localTodayTimestamp(now) - timestamp) / 86_400_000);
  if (days < 0) return { text: "日期在未來", value: "", status: "future" };
  const text = days === 0 ? "今天" : `${prefix} ${days} 天`;
  return { text, value: text, status: "valid", days };
}
