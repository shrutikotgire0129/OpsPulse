import assert from "node:assert/strict";
import test from "node:test";

import { dashboardQuerySchema } from "../src/modules/analytics/analytics.schema.js";

test("Dashboard query defaults to the 30-day range", () => {
  const result = dashboardQuerySchema.safeParse({});

  assert.equal(result.success, true);

  if (result.success) {
    assert.equal(result.data.range, "30d");
  }
});

test("Supported reporting ranges are accepted", () => {
  for (const range of ["7d", "30d", "90d", "12m"]) {
    const result = dashboardQuerySchema.safeParse({ range });

    assert.equal(result.success, true, `Expected ${range} to be accepted.`);
  }
});

test("Unsupported reporting ranges are rejected", () => {
  const result = dashboardQuerySchema.safeParse({ range: "365d" });

  assert.equal(result.success, false);
});

test("Valid custom date ranges are accepted", () => {
  const result = dashboardQuerySchema.safeParse({
    startDate: "2026-01-01",
    endDate: "2026-01-31",
  });

  assert.equal(result.success, true);
});

test("Leap-year dates are accepted", () => {
  const result = dashboardQuerySchema.safeParse({
    startDate: "2024-02-29",
    endDate: "2024-03-01",
  });

  assert.equal(result.success, true);
});

test("Invalid calendar dates are rejected", () => {
  for (const date of ["2026-02-29", "2026-13-01", "2026-04-31"]) {
    const result = dashboardQuerySchema.safeParse({
      startDate: date,
      endDate: "2026-12-31",
    });

    assert.equal(result.success, false, `Expected ${date} to be rejected.`);
  }
});

test("Custom ranges require both dates", () => {
  assert.equal(
    dashboardQuerySchema.safeParse({ startDate: "2026-01-01" }).success,
    false,
  );

  assert.equal(
    dashboardQuerySchema.safeParse({ endDate: "2026-01-31" }).success,
    false,
  );
});

test("Start date cannot be after end date", () => {
  const result = dashboardQuerySchema.safeParse({
    startDate: "2026-02-01",
    endDate: "2026-01-01",
  });

  assert.equal(result.success, false);
});

test("Unexpected query parameters are rejected", () => {
  const result = dashboardQuerySchema.safeParse({
    range: "30d",
    organizationId: "another-organization",
  });

  assert.equal(result.success, false);
});
