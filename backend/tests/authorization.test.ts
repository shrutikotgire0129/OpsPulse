import assert from "node:assert/strict";
import test from "node:test";

import {
  hasPermission,
  isOrganizationRole,
  MEMBERSHIP_ROLES,
  PERMISSIONS,
} from "../src/middleware/authorization.js";

test("all five organization roles are recognized", () => {
  assert.deepEqual(MEMBERSHIP_ROLES, [
    "OWNER",
    "ADMIN",
    "MANAGER",
    "ANALYST",
    "MEMBER",
  ]);

  for (const role of MEMBERSHIP_ROLES) {
    assert.equal(isOrganizationRole(role), true);
  }
});

test("invalid roles are rejected", () => {
  assert.equal(isOrganizationRole("SUPER_ADMIN"), false);
  assert.equal(isOrganizationRole("owner"), false);
  assert.equal(isOrganizationRole(null), false);
  assert.equal(isOrganizationRole(undefined), false);
  assert.equal(isOrganizationRole(123), false);
});

test("OWNER and ADMIN have all defined permissions", () => {
  for (const permission of PERMISSIONS) {
    assert.equal(hasPermission("OWNER", permission), true);
    assert.equal(hasPermission("ADMIN", permission), true);
  }
});

test("MANAGER can manage daily business operations but not administration", () => {
  const allowed = [
    "categories:read",
    "categories:write",
    "products:read",
    "products:write",
    "customers:read",
    "customers:write",
    "orders:read",
    "orders:write",
    "analytics:read",
    "reports:read",
    "payments:read",
    "refunds:read",
  ] as const;

  const denied = [
    "payments:manage",
    "refunds:create",
    "organization:manage",
    "members:manage",
  ] as const;

  for (const permission of allowed) {
    assert.equal(hasPermission("MANAGER", permission), true);
  }

  for (const permission of denied) {
    assert.equal(hasPermission("MANAGER", permission), false);
  }
});

test("ANALYST has read-only analytics and reporting permissions", () => {
  const allowed = [
    "analytics:read",
    "categories:read",
    "products:read",
    "customers:read",
    "orders:read",
    "payments:read",
    "refunds:read",
    "reports:read",
  ] as const;

  for (const permission of allowed) {
    assert.equal(hasPermission("ANALYST", permission), true);
  }

  for (const permission of PERMISSIONS) {
    if (!allowed.includes(permission as (typeof allowed)[number])) {
      assert.equal(hasPermission("ANALYST", permission), false);
    }
  }
});

test("MEMBER has limited read-only operational permissions", () => {
  const allowed = [
    "categories:read",
    "products:read",
    "customers:read",
    "orders:read",
  ] as const;

  for (const permission of allowed) {
    assert.equal(hasPermission("MEMBER", permission), true);
  }

  for (const permission of PERMISSIONS) {
    if (!allowed.includes(permission as (typeof allowed)[number])) {
      assert.equal(hasPermission("MEMBER", permission), false);
    }
  }
});

test("unknown roles never receive permissions", () => {
  assert.equal(hasPermission("SUPER_ADMIN", "products:read"), false);
  assert.equal(hasPermission(null, "orders:read"), false);
  assert.equal(hasPermission(undefined, "analytics:read"), false);
});
