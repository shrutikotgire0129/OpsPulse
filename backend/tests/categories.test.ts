
import test from "node:test";
import assert from "node:assert/strict";

import {
  categoryIdParamsSchema,
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from "../src/modules/categories/category.schema.js";

test("category creation accepts valid input and trims strings", () => {
  const result = createCategorySchema.safeParse({
    name: "  Electronics  ",
    description: "  Electronic products  ",
  });

  assert.equal(result.success, true);

  if (result.success) {
    assert.equal(result.data.name, "Electronics");
    assert.equal(result.data.description, "Electronic products");
  }
});

test("category creation rejects missing or short names", () => {
  assert.equal(
    createCategorySchema.safeParse({ name: " " }).success,
    false,
  );

  assert.equal(
    createCategorySchema.safeParse({ name: "A" }).success,
    false,
  );
});

test("category creation rejects client-supplied organization IDs", () => {
  const result = createCategorySchema.safeParse({
    name: "Electronics",
    organizationId: "untrusted-organization",
  });

  assert.equal(result.success, false);
});

test("category update accepts partial updates", () => {
  assert.equal(
    updateCategorySchema.safeParse({
      name: "Updated Electronics",
    }).success,
    true,
  );
});

test("category update accepts null description and parent", () => {
  assert.equal(
    updateCategorySchema.safeParse({
      description: null,
      parentId: null,
    }).success,
    true,
  );
});

test("category update rejects empty updates", () => {
  assert.equal(
    updateCategorySchema.safeParse({}).success,
    false,
  );
});

test("category list query applies pagination defaults", () => {
  const result = listCategoriesQuerySchema.safeParse({});

  assert.equal(result.success, true);

  if (result.success) {
    assert.equal(result.data.page, 1);
    assert.equal(result.data.limit, 20);
  }
});

test("category list query coerces valid pagination values", () => {
  const result = listCategoriesQuerySchema.safeParse({
    page: "2",
    limit: "50",
    search: "Electronics",
  });

  assert.equal(result.success, true);

  if (result.success) {
    assert.equal(result.data.page, 2);
    assert.equal(result.data.limit, 50);
  }
});

test("category list query rejects invalid pagination values", () => {
  assert.equal(
    listCategoriesQuerySchema.safeParse({
      page: "0",
    }).success,
    false,
  );

  assert.equal(
    listCategoriesQuerySchema.safeParse({
      limit: "101",
    }).success,
    false,
  );
});

test("category ID parameters reject empty IDs", () => {
  assert.equal(
    categoryIdParamsSchema.safeParse({
      categoryId: "",
    }).success,
    false,
  );
});
