import { ApiError } from "../../lib/http/api-error.js";

import type { DashboardQuery, ReportingPeriod } from "./analytics.types.js";

interface DateRange {
  startDate: string;
  endDate: string;
}

function getDateParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new ApiError(
      500,
      "ANALYTICS_DATE_ERROR",
      "Unable to resolve the reporting date.",
    );
  }

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    date: `${year}-${month}-${day}`,
  };
}

function addCalendarDays(date: string, amount: number): string {
  const parts = date.split("-").map(Number);
  const year = parts[0] ?? NaN;
  const month = parts[1] ?? NaN;
  const day = parts[2] ?? NaN;

  const result = new Date(Date.UTC(year, month - 1, day + amount));

  return [
    result.getUTCFullYear(),
    String(result.getUTCMonth() + 1).padStart(2, "0"),
    String(result.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Convert a local calendar date and time into a UTC instant.
 *
 * Iterative correction accounts for timezone offsets and daylight-saving
 * transitions without assuming that every day contains 24 hours.
 */
function zonedDateTimeToUtc(
  date: string,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const dateParts = date.split("-").map(Number);
  const year = dateParts[0] ?? NaN;
  const month = dateParts[1] ?? NaN;
  const day = dateParts[2] ?? NaN;

  const target = Date.UTC(year, month - 1, day, hour, minute);

  let candidate = target;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(candidate));

    const values = Object.fromEntries(
      parts.map((part) => [part.type, Number(part.value)]),
    );

    const yearValue = values.year ?? NaN;
    const monthValue = values.month ?? NaN;
    const dayValue = values.day ?? NaN;
    const hourValue = values.hour ?? NaN;
    const minuteValue = values.minute ?? NaN;
    const secondValue = values.second ?? NaN;

    if (
      ![
        yearValue,
        monthValue,
        dayValue,
        hourValue,
        minuteValue,
        secondValue,
      ].every(Number.isFinite)
    ) {
      throw new ApiError(
        500,
        "ANALYTICS_DATE_ERROR",
        "Unable to resolve the reporting time.",
      );
    }

    const represented = Date.UTC(
      yearValue,
      monthValue - 1,
      dayValue,
      hourValue,
      minuteValue,
      secondValue,
    );

    const difference = target - represented;

    if (difference === 0) {
      return new Date(candidate);
    }

    candidate += difference;
  }

  throw new ApiError(
    422,
    "INVALID_REPORTING_TIMEZONE",
    "Unable to resolve the reporting date boundary in the organization's timezone.",
  );
}

function resolveDateRange(query: DashboardQuery, today: string): DateRange {
  if (query.startDate && query.endDate) {
    return {
      startDate: query.startDate,
      endDate: query.endDate,
    };
  }

  if (query.range === "12m") {
    const parts = today.split("-").map(Number);
    const year = parts[0] ?? NaN;
    const month = parts[1] ?? NaN;

    const currentMonth = new Date(Date.UTC(year, month - 1, 1));

    const start = new Date(
      Date.UTC(
        currentMonth.getUTCFullYear(),
        currentMonth.getUTCMonth() - 11,
        1,
      ),
    );

    return {
      startDate: [
        start.getUTCFullYear(),
        String(start.getUTCMonth() + 1).padStart(2, "0"),
        "01",
      ].join("-"),
      endDate: today,
    };
  }

  const days = Number(query.range.replace("d", ""));

  return {
    startDate: addCalendarDays(today, -(days - 1)),
    endDate: today,
  };
}

export function resolveReportingPeriod(
  query: DashboardQuery,
  timezone: string,
  currencyCode: string,
  now = new Date(),
): ReportingPeriod & {
  startInclusive: Date;
  endExclusive: Date;
} {
  try {
    // Validate the configured timezone before calculating boundaries.
    const today = getDateParts(now, timezone).date;

    const range = resolveDateRange(query, today);

    const endExclusiveDate = addCalendarDays(range.endDate, 1);

    return {
      ...range,
      timezone,
      currencyCode,
      startInclusive: zonedDateTimeToUtc(range.startDate, 0, 0, timezone),
      endExclusive: zonedDateTimeToUtc(endExclusiveDate, 0, 0, timezone),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      422,
      "INVALID_REPORTING_TIMEZONE",
      "The organization's reporting timezone is invalid.",
    );
  }
}
