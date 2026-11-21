import assert from "node:assert/strict";
import test from "node:test";

import {
  createCustomerSchema,
  customerIdParamsSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from "../src/modules/customers/customer.schema.js";

test("Customer request schemas", async (t) => {
  await t.test("accepts a valid customer creation payload", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "Shruti",
      lastName: "Kotgire",
      company: "Example Technologies",
      email: "CUSTOMER@EXAMPLE.COM",
      phone: "+91 9876543210",
      notes: "Important customer.",
      status: "ACTIVE",
    });

    assert.equal(result.success, true);

    if (result.success) {
      assert.equal(result.data.email, "customer@example.com");
    }
  });

  await t.test("accepts minimal customer creation data", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
    });

    assert.equal(result.success, true);
  });

  await t.test("trims customer name fields", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "  John  ",
      lastName: "  Doe  ",
    });

    assert.equal(result.success, true);

    if (result.success) {
      assert.equal(result.data.firstName, "John");
      assert.equal(result.data.lastName, "Doe");
    }
  });

  await t.test("rejects a missing first name", () => {
    const result = createCustomerSchema.safeParse({
      lastName: "Doe",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a missing last name", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "John",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects empty first and last names", () => {
    assert.equal(
      createCustomerSchema.safeParse({
        firstName: " ",
        lastName: "Doe",
      }).success,
      false,
    );

    assert.equal(
      createCustomerSchema.safeParse({
        firstName: "John",
        lastName: " ",
      }).success,
      false,
    );
  });

  await t.test("rejects names longer than 100 characters", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "A".repeat(101),
      lastName: "Doe",
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts and normalizes email addresses", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "  CUSTOMER@EXAMPLE.COM  ",
    });

    assert.equal(result.success, true);

    if (result.success) {
      assert.equal(result.data.email, "customer@example.com");
    }
  });

  await t.test("rejects invalid email addresses", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: "not-an-email",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an email address longer than 320 characters", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      email: `${"a".repeat(310)}@example.com`,
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an empty company value", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      company: " ",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a company name longer than 160 characters", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      company: "A".repeat(161),
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an empty phone value", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      phone: " ",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a phone number longer than 30 characters", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      phone: "1".repeat(31),
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects empty notes", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      notes: " ",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects notes longer than 5000 characters", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      notes: "A".repeat(5001),
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects unsupported customer statuses", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      status: "INACTIVE",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects client-supplied organization IDs", () => {
    const result = createCustomerSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      organizationId: "untrusted-organization",
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts a partial customer update", () => {
    const result = updateCustomerSchema.safeParse({
      firstName: "Updated",
    });

    assert.equal(result.success, true);
  });

  await t.test("accepts null values for optional customer fields", () => {
    const result = updateCustomerSchema.safeParse({
      company: null,
      email: null,
      phone: null,
      notes: null,
    });

    assert.equal(result.success, true);
  });

  await t.test("normalizes email addresses during updates", () => {
    const result = updateCustomerSchema.safeParse({
      email: "  CUSTOMER@EXAMPLE.COM  ",
    });

    assert.equal(result.success, true);

    if (result.success) {
      assert.equal(result.data.email, "customer@example.com");
    }
  });

  await t.test("rejects an empty customer update", () => {
    const result = updateCustomerSchema.safeParse({});

    assert.equal(result.success, false);
  });

  await t.test("rejects invalid customer update fields", () => {
    const result = updateCustomerSchema.safeParse({
      email: "invalid-email",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects unknown customer update fields", () => {
    const result = updateCustomerSchema.safeParse({
      firstName: "Updated",
      organizationId: "untrusted-organization",
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts a valid customer ID parameter", () => {
    const result = customerIdParamsSchema.safeParse({
      customerId: "customer-123",
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects an empty customer ID parameter", () => {
    const result = customerIdParamsSchema.safeParse({
      customerId: " ",
    });

    assert.equal(result.success, false);
  });

  await t.test("applies default customer list query values", () => {
    const result = listCustomersQuerySchema.safeParse({});

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

  await t.test("coerces customer pagination query values", () => {
    const result = listCustomersQuerySchema.safeParse({
      page: "2",
      limit: "50",
    });

    assert.equal(result.success, true);

    if (result.success) {
      assert.equal(result.data.page, 2);
      assert.equal(result.data.limit, 50);
    }
  });

  await t.test("accepts customer search, status and sorting filters", () => {
    const result = listCustomersQuerySchema.safeParse({
      page: "3",
      limit: "25",
      search: "john@example.com",
      status: "ACTIVE",
      sortBy: "lastName",
      sortOrder: "asc",
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects a page number below one", () => {
    const result = listCustomersQuerySchema.safeParse({
      page: "0",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a customer list limit above 100", () => {
    const result = listCustomersQuerySchema.safeParse({
      limit: "101",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an unsupported customer sort field", () => {
    const result = listCustomersQuerySchema.safeParse({
      sortBy: "email",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects unknown customer list query fields", () => {
    const result = listCustomersQuerySchema.safeParse({
      page: "1",
      organizationId: "untrusted-organization",
    });

    assert.equal(result.success, false);
  });
});
