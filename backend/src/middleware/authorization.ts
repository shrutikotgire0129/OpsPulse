import type { RequestHandler } from "express";

import { ApiError } from "../lib/http/api-error.js";

export const MEMBERSHIP_ROLES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "ANALYST",
  "MEMBER",
] as const;

export type OrganizationRole = (typeof MEMBERSHIP_ROLES)[number];

export const PERMISSIONS = [
  "analytics:read",
  "categories:read",
  "categories:write",
  "products:read",
  "products:write",
  "customers:read",
  "customers:write",
  "orders:read",
  "orders:write",
  "payments:read",
  "payments:manage",
  "refunds:read",
  "refunds:create",
  "reports:read",
  "organization:manage",
  "members:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<
  OrganizationRole,
  readonly Permission[]
> = {
  OWNER: PERMISSIONS,

  ADMIN: PERMISSIONS,

  MANAGER: [
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
  ],

  ANALYST: [
    "analytics:read",
    "categories:read",
    "products:read",
    "customers:read",
    "orders:read",
    "payments:read",
    "refunds:read",
    "reports:read",
  ],

  MEMBER: [
    "categories:read",
    "products:read",
    "customers:read",
    "orders:read",
  ],
};

export function isOrganizationRole(
  value: unknown,
): value is OrganizationRole {
  return (
    typeof value === "string" &&
    MEMBERSHIP_ROLES.some((role) => role === value)
  );
}

export function hasPermission(
  role: unknown,
  permission: Permission,
): boolean {
  if (!isOrganizationRole(role)) {
    return false;
  }

  return ROLE_PERMISSIONS[role].includes(permission);
}

export function authorize(permission: Permission): RequestHandler {
  return (_req, res, next) => {
    const role: unknown = res.locals.organizationRole;

    if (!isOrganizationRole(role)) {
      return next(
        new ApiError(
          403,
          "FORBIDDEN",
          "You do not have permission to perform this action.",
        ),
      );
    }

    if (!hasPermission(role, permission)) {
      return next(
        new ApiError(
          403,
          "FORBIDDEN",
          "You do not have permission to perform this action.",
        ),
      );
    }

    return next();
  };
}
