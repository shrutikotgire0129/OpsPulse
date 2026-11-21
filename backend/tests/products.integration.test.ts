import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { env } from "../src/config/env.js";
import { ApiError } from "../src/lib/http/api-error.js";
import { prisma } from "../src/lib/prisma.js";

import type { ProductContext } from "../src/modules/products/product.types.js";

import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "../src/modules/products/product.service.js";

test("Product service PostgreSQL integration", async (t) => {
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
  const organizationIds: string[] = [];

  let firstContext: ProductContext;
  let secondContext: ProductContext;

  let firstCategoryId = "";
  let secondCategoryId = "";
  let historyProductId = "";
  let orderId = "";

  try {
    const firstOrganization = await prisma.organization.create({
      data: {
        name: `Product Integration Organization A ${uniqueId}`,
        slug: `opspulse-product-it-a-${uniqueId}`,
        currencyCode: "INR",
      },
    });

    organizationIds.push(firstOrganization.id);

    const secondOrganization = await prisma.organization.create({
      data: {
        name: `Product Integration Organization B ${uniqueId}`,
        slug: `opspulse-product-it-b-${uniqueId}`,
        currencyCode: "USD",
      },
    });

    organizationIds.push(secondOrganization.id);

    firstContext = { organizationId: firstOrganization.id };
    secondContext = { organizationId: secondOrganization.id };

    const firstCategory = await prisma.category.create({
      data: {
        organizationId: firstOrganization.id,
        name: "Electronics",
        slug: `electronics-${uniqueId}`,
      },
    });

    firstCategoryId = firstCategory.id;

    const secondCategory = await prisma.category.create({
      data: {
        organizationId: secondOrganization.id,
        name: "Office Supplies",
        slug: `office-supplies-${uniqueId}`,
      },
    });

    secondCategoryId = secondCategory.id;

    let keyboardId = "";
    let secondKeyboardId = "";
    let notebookId = "";
    let mouseId = "";

    await t.test("creates products and generates unique slugs", async () => {
      const first = await createProduct(firstContext, {
        name: "Wireless Keyboard",
        description: "Mechanical wireless keyboard",
        sku: `KEY-${uniqueId}`,
        barcode: `BAR-${uniqueId}`,
        price: "2499.9900",
        cost: "1500.5000",
        categoryId: firstCategoryId,
        status: "ACTIVE",
      });

      const duplicateName = await createProduct(firstContext, {
        name: "Wireless Keyboard",
        price: "1999.00",
      });

      keyboardId = first.id;
      secondKeyboardId = duplicateName.id;

      assert.equal(first.slug, "wireless-keyboard");
      assert.equal(duplicateName.slug, "wireless-keyboard-2");
      assert.equal(first.organizationId, firstOrganization.id);
      assert.equal(first.currencyCode, "INR");
      assert.equal(first.price.toString(), "2499.99");
      assert.equal(first.cost?.toString(), "1500.5");
      assert.equal(first.category?.id, firstCategoryId);
    });

    await t.test("uses the explicitly supplied currency code", async () => {
      const product = await createProduct(firstContext, {
        name: "Imported Product",
        price: "100.00",
        currencyCode: "EUR",
      });

      assert.equal(product.currencyCode, "EUR");
    });

    await t.test("rejects duplicate SKU and barcode values", async () => {
      await assert.rejects(
        () =>
          createProduct(firstContext, {
            name: "Another Keyboard",
            price: "500.00",
            sku: `KEY-${uniqueId}`,
          }),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "PRODUCT_CONFLICT" &&
          error.statusCode === 409,
      );

      await assert.rejects(
        () =>
          createProduct(firstContext, {
            name: "Another Barcode Product",
            price: "500.00",
            barcode: `BAR-${uniqueId}`,
          }),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "PRODUCT_CONFLICT" &&
          error.statusCode === 409,
      );
    });

    await t.test(
      "allows the same SKU in a different organization",
      async () => {
        const product = await createProduct(secondContext, {
          name: "Wireless Keyboard",
          price: "75.00",
          sku: `KEY-${uniqueId}`,
        });

        assert.equal(product.organizationId, secondOrganization.id);
        assert.equal(product.sku, `KEY-${uniqueId}`);
      },
    );

    await t.test("rejects a category from another organization", async () => {
      await assert.rejects(
        () =>
          createProduct(firstContext, {
            name: "Invalid Cross Organization Product",
            price: "100.00",
            categoryId: secondCategoryId,
          }),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "CATEGORY_NOT_FOUND" &&
          error.statusCode === 404,
      );
    });

    await t.test(
      "lists products with pagination, search and filters",
      async () => {
        const notebook = await createProduct(firstContext, {
          name: "Notebook",
          sku: `NOTE-${uniqueId}`,
          price: "49.99",
          categoryId: firstCategoryId,
          status: "ACTIVE",
        });

        const mouse = await createProduct(firstContext, {
          name: "Wireless Mouse",
          sku: `MOUSE-${uniqueId}`,
          price: "799.00",
          status: "DRAFT",
        });

        notebookId = notebook.id;
        mouseId = mouse.id;

        const allProducts = await listProducts(firstContext, {
          page: 1,
          limit: 2,
          sortBy: "name",
          sortOrder: "asc",
        });

        assert.equal(allProducts.pagination.page, 1);
        assert.equal(allProducts.pagination.limit, 2);
        assert.equal(allProducts.pagination.total, 5);
        assert.equal(allProducts.pagination.totalPages, 3);
        assert.equal(allProducts.pagination.hasNextPage, true);

        const searchResult = await listProducts(firstContext, {
          page: 1,
          limit: 20,
          search: "wireless",
          sortBy: "name",
          sortOrder: "asc",
        });

        assert.equal(searchResult.pagination.total, 3);
        assert.ok(
          searchResult.items.every((product) =>
            product.name.toLowerCase().includes("wireless"),
          ),
        );

        const categoryResult = await listProducts(firstContext, {
          page: 1,
          limit: 20,
          categoryId: firstCategoryId,
          sortBy: "name",
          sortOrder: "asc",
        });

        assert.equal(categoryResult.pagination.total, 2);
        assert.ok(
          categoryResult.items.every(
            (product) => product.categoryId === firstCategoryId,
          ),
        );

        const statusResult = await listProducts(firstContext, {
          page: 1,
          limit: 20,
          status: "ACTIVE",
          sortBy: "name",
          sortOrder: "asc",
        });

        assert.equal(statusResult.pagination.total, 2);
        assert.ok(
          statusResult.items.every((product) => product.status === "ACTIVE"),
        );

        const priceSorted = await listProducts(firstContext, {
          page: 1,
          limit: 20,
          sortBy: "price",
          sortOrder: "asc",
        });

        assert.ok(
          Number(priceSorted.items[0]?.price) <=
            Number(priceSorted.items[1]?.price),
        );

        const secondOrganizationProducts = await listProducts(secondContext, {
          page: 1,
          limit: 20,
          sortBy: "createdAt",
          sortOrder: "desc",
        });

        assert.ok(
          secondOrganizationProducts.items.every(
            (product) => product.organizationId === secondOrganization.id,
          ),
        );
      },
    );

    await t.test(
      "retrieves products without leaking another organization's data",
      async () => {
        const product = await getProduct(firstContext, keyboardId);

        assert.equal(product.id, keyboardId);
        assert.equal(product.organizationId, firstOrganization.id);
        assert.equal(product.category?.id, firstCategoryId);
        assert.equal(product._count.orderItems, 0);

        await assert.rejects(
          () => getProduct(secondContext, keyboardId),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "PRODUCT_NOT_FOUND" &&
            error.statusCode === 404,
        );

        await assert.rejects(
          () =>
            updateProduct(secondContext, keyboardId, { name: "Unauthorized" }),
          (error: unknown) =>
            error instanceof ApiError && error.code === "PRODUCT_NOT_FOUND",
        );
      },
    );

    await t.test(
      "updates product fields and clears nullable values",
      async () => {
        const updated = await updateProduct(firstContext, keyboardId, {
          name: "Wireless Keyboard Pro",
          description: null,
          sku: null,
          barcode: null,
          cost: null,
          categoryId: null,
          price: "2799.5000",
          status: "ACTIVE",
        });

        assert.equal(updated.name, "Wireless Keyboard Pro");
        assert.equal(updated.slug, "wireless-keyboard-pro");
        assert.equal(updated.description, null);
        assert.equal(updated.sku, null);
        assert.equal(updated.barcode, null);
        assert.equal(updated.cost, null);
        assert.equal(updated.categoryId, null);
        assert.equal(updated.price.toString(), "2799.5");
        assert.equal(updated.status, "ACTIVE");
      },
    );

    await t.test(
      "rejects assigning a category from another organization during update",
      async () => {
        await assert.rejects(
          () =>
            updateProduct(firstContext, keyboardId, {
              categoryId: secondCategoryId,
            }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "CATEGORY_NOT_FOUND" &&
            error.statusCode === 404,
        );
      },
    );

    await t.test("rejects updates that violate SKU uniqueness", async () => {
      await assert.rejects(
        () =>
          updateProduct(firstContext, secondKeyboardId, {
            sku: `NOTE-${uniqueId}`,
          }),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "PRODUCT_CONFLICT" &&
          error.statusCode === 409,
      );
    });

    await t.test("deletes products that have no order history", async () => {
      const result = await deleteProduct(firstContext, mouseId);

      assert.equal(result.id, mouseId);
      assert.equal(result.deleted, true);

      await assert.rejects(
        () => getProduct(firstContext, mouseId),
        (error: unknown) =>
          error instanceof ApiError && error.code === "PRODUCT_NOT_FOUND",
      );
    });

    await t.test(
      "prevents deleting products referenced by order history",
      async () => {
        const historyProduct = await createProduct(firstContext, {
          name: "Order History Product",
          price: "500.00",
          sku: `HISTORY-${uniqueId}`,
        });

        historyProductId = historyProduct.id;

        const order = await prisma.order.create({
          data: {
            organizationId: firstOrganization.id,
            orderNumber: `ORDER-${uniqueId}`,
            currencyCode: "INR",
            subtotal: "500.00",
            grandTotal: "500.00",
          },
        });

        orderId = order.id;

        await prisma.orderItem.create({
          data: {
            organizationId: firstOrganization.id,
            orderId: order.id,
            productId: historyProduct.id,
            lineNumber: 1,
            productName: historyProduct.name,
            sku: historyProduct.sku,
            quantity: "1.0000",
            unitPrice: "500.0000",
            lineTotal: "500.0000",
          },
        });

        await assert.rejects(
          () => deleteProduct(firstContext, historyProduct.id),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "PRODUCT_HAS_ORDER_HISTORY" &&
            error.statusCode === 409 &&
            (error.details as { orderItemCount?: number })?.orderItemCount ===
              1,
        );

        const stillExists = await getProduct(firstContext, historyProduct.id);

        assert.equal(stillExists.id, historyProduct.id);
        assert.equal(stillExists._count.orderItems, 1);
      },
    );

    await t.test(
      "returns not found when retrieving a deleted product",
      async () => {
        await assert.rejects(
          () => getProduct(firstContext, mouseId),
          (error: unknown) =>
            error instanceof ApiError && error.code === "PRODUCT_NOT_FOUND",
        );
      },
    );

    // Keep references to these variables explicit for cleanup verification.
    assert.ok(secondKeyboardId);
    assert.ok(notebookId);
  } finally {
    // Cleanup is restricted to organizations created by this test run.
    if (organizationIds.length > 0) {
      await prisma.orderItem.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });

      await prisma.payment.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });

      await prisma.order.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });

      await prisma.product.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });

      await prisma.category.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });

      await prisma.organization.deleteMany({
        where: {
          id: { in: organizationIds },
        },
      });
    }

    await prisma.$disconnect();
  }
});
