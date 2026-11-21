import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { env } from "../src/config/env.js";
import { ApiError } from "../src/lib/http/api-error.js";
import { prisma } from "../src/lib/prisma.js";

import type { CategoryContext } from "../src/modules/categories/category.types.js";

import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "../src/modules/categories/category.service.js";

test("Category service PostgreSQL integration", async (t) => {
  // Safety guard: never run destructive integration tests against another DB.
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.replace(/^\/+/, ""),
  );

  assert.equal(
    databaseName,
    "opspulse_test",
    `Integration tests require database "opspulse_test", received "${databaseName}". No test records were created.`,
  );

  const uniqueId = randomUUID().replace(/-/g, "");
  const organizationSlugs: string[] = [];

  let organizationIds: string[] = [];
  let firstContext: CategoryContext;
  let secondContext: CategoryContext;

  try {
    const firstOrganization = await prisma.organization.create({
      data: {
        name: `Integration Test Organization A ${uniqueId}`,
        slug: `opspulse-it-a-${uniqueId}`,
      },
    });

    organizationSlugs.push(firstOrganization.slug);
    organizationIds.push(firstOrganization.id);

    const secondOrganization = await prisma.organization.create({
      data: {
        name: `Integration Test Organization B ${uniqueId}`,
        slug: `opspulse-it-b-${uniqueId}`,
      },
    });

    organizationSlugs.push(secondOrganization.slug);
    organizationIds.push(secondOrganization.id);

    firstContext = { organizationId: firstOrganization.id };
    secondContext = { organizationId: secondOrganization.id };

    await t.test("creates categories and generates unique slugs", async () => {
      const first = await createCategory(firstContext, {
        name: "Electronics",
        description: "Electronic devices",
      });

      const duplicate = await createCategory(firstContext, {
        name: "Electronics",
      });

      assert.equal(first.slug, "electronics");
      assert.equal(duplicate.slug, "electronics-2");
      assert.equal(first.organizationId, firstOrganization.id);
      assert.equal(first.description, "Electronic devices");
    });

    const root = await prisma.category.findFirstOrThrow({
      where: {
        organizationId: firstOrganization.id,
        slug: "electronics",
      },
    });

    const duplicateRoot = await prisma.category.findFirstOrThrow({
      where: {
        organizationId: firstOrganization.id,
        slug: "electronics-2",
      },
    });

    let childId = "";
    let grandchildId = "";
    let productId = "";

    await t.test("creates a category hierarchy", async () => {
      const child = await createCategory(firstContext, {
        name: "Accessories",
        parentId: root.id,
      });

      const grandchild = await createCategory(firstContext, {
        name: "Cases",
        parentId: child.id,
      });

      childId = child.id;
      grandchildId = grandchild.id;

      assert.equal(child.parentId, root.id);
      assert.equal(child.parent?.id, root.id);
      assert.equal(grandchild.parentId, child.id);
    });

    await t.test("lists categories with pagination and filters", async () => {
      const result = await listCategories(firstContext, {
        page: 1,
        limit: 2,
      });

      assert.equal(result.pagination.page, 1);
      assert.equal(result.pagination.limit, 2);
      assert.equal(result.pagination.total, 4);
      assert.equal(result.pagination.totalPages, 2);
      assert.equal(result.pagination.hasNextPage, true);

      const searchResult = await listCategories(firstContext, {
        page: 1,
        limit: 20,
        search: "electronics",
      });

      assert.equal(searchResult.pagination.total, 2);

      const children = await listCategories(firstContext, {
        page: 1,
        limit: 20,
        parentId: root.id,
      });

      assert.equal(children.pagination.total, 1);
      assert.equal(children.items[0]?.id, childId);
    });

    await t.test("retrieves categories without leaking another organization's data", async () => {
      const category = await getCategory(firstContext, root.id);

      assert.equal(category.id, root.id);
      assert.equal(category.children.length, 1);
      assert.equal(category._count.children, 1);

      await assert.rejects(
        () => getCategory(secondContext, root.id),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "CATEGORY_NOT_FOUND" &&
          error.statusCode === 404,
      );

      const secondOrganizationCategories = await listCategories(
        secondContext,
        { page: 1, limit: 20 },
      );

      assert.equal(secondOrganizationCategories.pagination.total, 0);
    });

    await t.test("rejects a parent category from another organization", async () => {
      await assert.rejects(
        () =>
          createCategory(secondContext, {
            name: "Invalid Cross Organization Child",
            parentId: root.id,
          }),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "PARENT_CATEGORY_NOT_FOUND" &&
          error.statusCode === 404,
      );
    });

    await t.test("prevents circular category hierarchies", async () => {
      await assert.rejects(
        () =>
          updateCategory(firstContext, root.id, {
            parentId: grandchildId,
          }),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "CATEGORY_HIERARCHY_CYCLE" &&
          error.statusCode === 400,
      );
    });

    await t.test("updates category names, slugs and nullable fields", async () => {
      const updated = await updateCategory(firstContext, duplicateRoot.id, {
        name: "Smart Phones",
        description: null,
        parentId: null,
      });

      assert.equal(updated.name, "Smart Phones");
      assert.equal(updated.slug, "smart-phones");
      assert.equal(updated.description, null);
      assert.equal(updated.parentId, null);
    });

    await t.test("prevents deleting categories with children", async () => {
      await assert.rejects(
        () => deleteCategory(firstContext, root.id),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "CATEGORY_HAS_CHILDREN" &&
          error.statusCode === 409,
      );
    });

    await t.test("prevents deleting categories referenced by products", async () => {
      const product = await prisma.product.create({
        data: {
          organizationId: firstOrganization.id,
          name: `Integration Test Product ${uniqueId}`,
          slug: `integration-product-${uniqueId}`,
          price: "12.5000",
          categoryId: grandchildId,
        },
      });

      productId = product.id;

      await assert.rejects(
        () => deleteCategory(firstContext, grandchildId),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "CATEGORY_HAS_PRODUCTS" &&
          error.statusCode === 409,
      );
    });

    await t.test("deletes categories after references are removed", async () => {
      await prisma.product.delete({
        where: { id: productId },
      });

      productId = "";

      const grandchildDeletion = await deleteCategory(
        firstContext,
        grandchildId,
      );

      assert.equal(grandchildDeletion.deleted, true);

      const childDeletion = await deleteCategory(firstContext, childId);

      assert.equal(childDeletion.deleted, true);

      const rootDeletion = await deleteCategory(firstContext, root.id);

      assert.equal(rootDeletion.deleted, true);

      const duplicateDeletion = await deleteCategory(
        firstContext,
        duplicateRoot.id,
      );

      assert.equal(duplicateDeletion.deleted, true);
    });

    await t.test("returns not found for a deleted category", async () => {
      await assert.rejects(
        () => getCategory(firstContext, root.id),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "CATEGORY_NOT_FOUND",
      );
    });
  } finally {
    // Cleanup is restricted to organizations created by this test run.
    if (organizationIds.length > 0) {
      await prisma.product.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });

      // Delete leaf categories first to respect the self-referencing FK.
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const leaves = await prisma.category.findMany({
          where: {
            organizationId: { in: organizationIds },
            children: { none: {} },
          },
          select: { id: true },
        });

        if (leaves.length === 0) break;

        await prisma.category.deleteMany({
          where: {
            id: { in: leaves.map((category) => category.id) },
            organizationId: { in: organizationIds },
          },
        });
      }

      await prisma.organization.deleteMany({
        where: { id: { in: organizationIds } },
      });
    }

    await prisma.$disconnect();
  }
});
