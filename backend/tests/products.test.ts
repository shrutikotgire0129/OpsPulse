import assert from "node:assert/strict";
import test from "node:test";

import {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamsSchema,
  updateProductSchema,
} from "../src/modules/products/product.schema.js";

test("Product request schemas", async (t) => {
  await t.test("accepts a valid product creation payload", () => {
    const result = createProductSchema.safeParse({
      name: "Wireless Keyboard",
      description: "A mechanical wireless keyboard.",
      sku: "KEY-001",
      barcode: "1234567890123",
      price: "2499.9900",
      cost: "1500.5000",
      currencyCode: "INR",
      status: "ACTIVE",
    });

    assert.equal(result.success, true);
  });

  await t.test("accepts a minimal product creation payload", () => {
    const result = createProductSchema.safeParse({
      name: "Notebook",
      price: "49.99",
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects a missing product name", () => {
    const result = createProductSchema.safeParse({
      price: "100.00",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a product name shorter than two characters", () => {
    const result = createProductSchema.safeParse({
      name: "A",
      price: "100.00",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a product name longer than 160 characters", () => {
    const result = createProductSchema.safeParse({
      name: "A".repeat(161),
      price: "100.00",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a missing product price", () => {
    const result = createProductSchema.safeParse({
      name: "Notebook",
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts zero as a product price", () => {
    const result = createProductSchema.safeParse({
      name: "Free Sample",
      price: "0",
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects a negative product price", () => {
    const result = createProductSchema.safeParse({
      name: "Notebook",
      price: "-10.00",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects more than four decimal places", () => {
    const result = createProductSchema.safeParse({
      name: "Notebook",
      price: "10.12345",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects more than fifteen integer digits", () => {
    const result = createProductSchema.safeParse({
      name: "Notebook",
      price: "1234567890123456.00",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a non-decimal price", () => {
    const result = createProductSchema.safeParse({
      name: "Notebook",
      price: "not-a-price",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an empty SKU", () => {
    const result = createProductSchema.safeParse({
      name: "Notebook",
      price: "10.00",
      sku: "   ",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an invalid currency code", () => {
    const result = createProductSchema.safeParse({
      name: "Notebook",
      price: "10.00",
      currencyCode: "inr",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an unsupported product status", () => {
    const result = createProductSchema.safeParse({
      name: "Notebook",
      price: "10.00",
      status: "AVAILABLE",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects unknown creation fields", () => {
    const result = createProductSchema.safeParse({
      name: "Notebook",
      price: "10.00",
      organizationId: "untrusted-organization",
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts a valid product update", () => {
    const result = updateProductSchema.safeParse({
      name: "Updated Notebook",
      price: "15.50",
      status: "ACTIVE",
    });

    assert.equal(result.success, true);
  });

  await t.test("accepts nullable fields when clearing product data", () => {
    const result = updateProductSchema.safeParse({
      description: null,
      sku: null,
      barcode: null,
      cost: null,
      categoryId: null,
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects an empty product update", () => {
    const result = updateProductSchema.safeParse({});

    assert.equal(result.success, false);
  });

  await t.test("rejects unknown product update fields", () => {
    const result = updateProductSchema.safeParse({
      name: "Updated Notebook",
      organizationId: "untrusted-organization",
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts a valid product ID parameter", () => {
    const result = productIdParamsSchema.safeParse({
      productId: "product-123",
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects an empty product ID parameter", () => {
    const result = productIdParamsSchema.safeParse({
      productId: " ",
    });

    assert.equal(result.success, false);
  });

  await t.test("applies default product list query values", () => {
    const result = listProductsQuerySchema.safeParse({});

    assert.equal(result.success, true);

    if (result.success) {
      assert.deepEqual(result.data, {
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
    }
  });

  await t.test("coerces pagination query values", () => {
    const result = listProductsQuerySchema.safeParse({
      page: "2",
      limit: "50",
    });

    assert.equal(result.success, true);

    if (result.success) {
      assert.equal(result.data.page, 2);
      assert.equal(result.data.limit, 50);
    }
  });

  await t.test("accepts valid product filters and sorting", () => {
    const result = listProductsQuerySchema.safeParse({
      page: "3",
      limit: "25",
      search: "keyboard",
      categoryId: "category-123",
      status: "ACTIVE",
      sortBy: "price",
      sortOrder: "asc",
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects a page number below one", () => {
    const result = listProductsQuerySchema.safeParse({
      page: "0",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a product list limit above 100", () => {
    const result = listProductsQuerySchema.safeParse({
      limit: "101",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an unsupported sort field", () => {
    const result = listProductsQuerySchema.safeParse({
      sortBy: "sku",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects unknown product list query fields", () => {
    const result = listProductsQuerySchema.safeParse({
      page: "1",
      organizationId: "untrusted-organization",
    });

    assert.equal(result.success, false);
  });
});
