import assert from "node:assert/strict";
import test from "node:test";

import { dashboardQuerySchema } from "../src/modules/analytics/analytics.schema.js";
import { resolveReportingPeriod } from "../src/modules/analytics/analytics.dates.js";

const currencyCode = "USD";

test("7-day reporting period includes today and the previous six days", () => {
  const query = dashboardQuerySchema.parse({ range: "7d" });

  const period = resolveReportingPeriod(
    query,
    "UTC",
    currencyCode,
    new Date("2026-11-24T12:00:00.000Z"),
  );

  assert.equal(period.startDate, "2026-11-18");
  assert.equal(period.endDate, "2026-11-24");
  assert.equal(period.startInclusive.toISOString(), "2026-11-18T00:00:00.000Z");
  assert.equal(period.endExclusive.toISOString(), "2026-11-25T00:00:00.000Z");
});

test("30-day reporting period includes exactly 30 calendar dates", () => {
  const query = dashboardQuerySchema.parse({ range: "30d" });

  const period = resolveReportingPeriod(
    query,
    "UTC",
    currencyCode,
    new Date("2026-11-24T12:00:00.000Z"),
  );

  assert.equal(period.startDate, "2026-10-26");
  assert.equal(period.endDate, "2026-11-24");
});

test("90-day reporting period resolves its calendar boundaries", () => {
  const query = dashboardQuerySchema.parse({ range: "90d" });

  const period = resolveReportingPeriod(
    query,
    "UTC",
    currencyCode,
    new Date("2026-11-24T12:00:00.000Z"),
  );

  assert.equal(period.startDate, "2026-08-27");
  assert.equal(period.endDate, "2026-11-24");
});

test("12-month reporting period starts at the first day of the month", () => {
  const query = dashboardQuerySchema.parse({ range: "12m" });

  const period = resolveReportingPeriod(
    query,
    "UTC",
    currencyCode,
    new Date("2026-11-24T12:00:00.000Z"),
  );

  assert.equal(period.startDate, "2025-12-01");
  assert.equal(period.endDate, "2026-11-24");
});

test("Custom dates override the preset reporting range", () => {
  const query = dashboardQuerySchema.parse({
    range: "7d",
    startDate: "2026-01-10",
    endDate: "2026-01-20",
  });

  const period = resolveReportingPeriod(
    query,
    "UTC",
    currencyCode,
    new Date("2026-11-24T12:00:00.000Z"),
  );

  assert.equal(period.startDate, "2026-01-10");
  assert.equal(period.endDate, "2026-01-20");
});

test("Reporting boundaries respect the Asia/Kolkata timezone", () => {
  const query = dashboardQuerySchema.parse({ range: "7d" });

  const period = resolveReportingPeriod(
    query,
    "Asia/Kolkata",
    "INR",
    new Date("2026-11-24T12:00:00.000Z"),
  );

  assert.equal(period.startDate, "2026-11-18");
  assert.equal(period.endDate, "2026-11-24");
  assert.equal(period.startInclusive.toISOString(), "2026-11-17T18:30:00.000Z");
  assert.equal(period.endExclusive.toISOString(), "2026-11-24T18:30:00.000Z");
});

test("Reporting boundaries account for daylight-saving transitions", () => {
  const query = dashboardQuerySchema.parse({ range: "7d" });

  const period = resolveReportingPeriod(
    query,
    "America/Los_Angeles",
    currencyCode,
    new Date("2026-03-08T12:00:00.000Z"),
  );

  assert.equal(period.startDate, "2026-03-02");
  assert.equal(period.endDate, "2026-03-08");
  assert.equal(period.startInclusive.toISOString(), "2026-03-02T08:00:00.000Z");
  assert.equal(period.endExclusive.toISOString(), "2026-03-09T07:00:00.000Z");

  const durationHours =
    (period.endExclusive.getTime() - period.startInclusive.getTime()) /
    (60 * 60 * 1000);

  assert.equal(durationHours, 167);
});

test("Invalid reporting timezones are rejected", () => {
  const query = dashboardQuerySchema.parse({ range: "7d" });

  assert.throws(() => {
    resolveReportingPeriod(
      query,
      "Invalid/Timezone",
      currencyCode,
      new Date("2026-11-24T12:00:00.000Z"),
    );
  });
});
