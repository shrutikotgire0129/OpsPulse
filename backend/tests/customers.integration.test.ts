import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { env } from "../src/config/env.js";
import { ApiError } from "../src/lib/http/api-error.js";
import { prisma } from "../src/lib/prisma.js";

import type { CustomerContext } from "../src/modules/customers/customer.types.js";

import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "../src/modules/customers/customer.service.js";

import {
  createCustomerSchema,
  updateCustomerSchema,
} from "../src/modules/customers/customer.schema.js";

function createValidatedCustomer(context: CustomerContext, input: unknown) {
  return createCustomer(context, createCustomerSchema.parse(input));
}

function updateValidatedCustomer(
  context: CustomerContext,
  customerId: string,
  input: unknown,
) {
  return updateCustomer(context, customerId, updateCustomerSchema.parse(input));
}

test("Customer service PostgreSQL integration", async (t) => {
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

  let firstContext: CustomerContext;
  let secondContext: CustomerContext;

  let firstOrganizationId = "";
  let secondOrganizationId = "";

  let primaryCustomerId = "";
  let historyCustomerId = "";
  let deletableCustomerId = "";
  let orderId = "";

  try {
    const firstOrganization = await prisma.organization.create({
      data: {
        name: `Customer Integration Organization A ${uniqueId}`,
        slug: `opspulse-customer-it-a-${uniqueId}`,
        currencyCode: "INR",
      },
    });

    organizationIds.push(firstOrganization.id);
    firstOrganizationId = firstOrganization.id;

    const secondOrganization = await prisma.organization.create({
      data: {
        name: `Customer Integration Organization B ${uniqueId}`,
        slug: `opspulse-customer-it-b-${uniqueId}`,
        currencyCode: "USD",
      },
    });

    organizationIds.push(secondOrganization.id);
    secondOrganizationId = secondOrganization.id;

    firstContext = { organizationId: firstOrganization.id };
    secondContext = { organizationId: secondOrganization.id };

    await t.test(
      "creates customers with normalized email addresses",
      async () => {
        const customer = await createValidatedCustomer(firstContext, {
          firstName: "John",
          lastName: "Doe",
          company: "Example Technologies",
          email: "  JOHN@EXAMPLE.COM  ",
          phone: "+91 9876543210",
          notes: "Integration test customer.",
          status: "ACTIVE",
        });

        primaryCustomerId = customer.id;

        assert.equal(customer.organizationId, firstOrganization.id);
        assert.equal(customer.firstName, "John");
        assert.equal(customer.lastName, "Doe");
        assert.equal(customer.company, "Example Technologies");
        assert.equal(customer.email, "john@example.com");
        assert.equal(customer.phone, "+91 9876543210");
        assert.equal(customer.status, "ACTIVE");
        assert.equal(customer._count.addresses, 0);
        assert.equal(customer._count.orders, 0);
      },
    );

    await t.test("creates customers without optional fields", async () => {
      const customer = await createValidatedCustomer(firstContext, {
        firstName: "Jane",
        lastName: "Smith",
      });

      assert.equal(customer.firstName, "Jane");
      assert.equal(customer.lastName, "Smith");
      assert.equal(customer.company, null);
      assert.equal(customer.email, null);
      assert.equal(customer.phone, null);
      assert.equal(customer.notes, null);
    });

    await t.test(
      "rejects duplicate emails within one organization",
      async () => {
        await assert.rejects(
          () =>
            createValidatedCustomer(firstContext, {
              firstName: "Duplicate",
              lastName: "Customer",
              email: "john@example.com",
            }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "CUSTOMER_CONFLICT" &&
            error.statusCode === 409,
        );
      },
    );

    await t.test(
      "allows the same email address in another organization",
      async () => {
        const customer = await createValidatedCustomer(secondContext, {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        });

        assert.equal(customer.organizationId, secondOrganization.id);
        assert.equal(customer.email, "john@example.com");
      },
    );

    await t.test("lists customers with pagination and sorting", async () => {
      await createValidatedCustomer(firstContext, {
        firstName: "Alice",
        lastName: "Anderson",
        company: "Alpha Systems",
        email: `alice-${uniqueId}@example.com`,
        status: "ACTIVE",
      });

      await createValidatedCustomer(firstContext, {
        firstName: "Bob",
        lastName: "Brown",
        company: "Beta Systems",
        email: `bob-${uniqueId}@example.com`,
        status: "ARCHIVED",
      });

      const allCustomers = await listCustomers(firstContext, {
        page: 1,
        limit: 2,
        sortBy: "firstName",
        sortOrder: "asc",
      });

      assert.equal(allCustomers.pagination.page, 1);
      assert.equal(allCustomers.pagination.limit, 2);
      assert.equal(allCustomers.pagination.total, 4);
      assert.equal(allCustomers.pagination.totalPages, 2);
      assert.equal(allCustomers.pagination.hasNextPage, true);
      assert.equal(allCustomers.pagination.hasPreviousPage, false);
      assert.equal(allCustomers.items.length, 2);

      assert.ok(
        allCustomers.items.every(
          (customer) => customer.organizationId === firstOrganization.id,
        ),
      );

      const secondPage = await listCustomers(firstContext, {
        page: 2,
        limit: 2,
        sortBy: "firstName",
        sortOrder: "asc",
      });

      assert.equal(secondPage.items.length, 2);
      assert.equal(secondPage.pagination.hasPreviousPage, true);
      assert.equal(secondPage.pagination.hasNextPage, false);
    });

    await t.test("searches customers across supported fields", async () => {
      const nameResult = await listCustomers(firstContext, {
        page: 1,
        limit: 20,
        search: "john",
        sortBy: "firstName",
        sortOrder: "asc",
      });

      assert.equal(nameResult.pagination.total, 1);
      assert.equal(nameResult.items[0]?.id, primaryCustomerId);

      const companyResult = await listCustomers(firstContext, {
        page: 1,
        limit: 20,
        search: "Example Technologies",
        sortBy: "firstName",
        sortOrder: "asc",
      });

      assert.equal(companyResult.pagination.total, 1);
      assert.equal(companyResult.items[0]?.id, primaryCustomerId);

      const emailResult = await listCustomers(firstContext, {
        page: 1,
        limit: 20,
        search: "john@example.com",
        sortBy: "firstName",
        sortOrder: "asc",
      });

      assert.equal(emailResult.pagination.total, 1);
    });

    await t.test("filters customers by status", async () => {
      const activeResult = await listCustomers(firstContext, {
        page: 1,
        limit: 20,
        status: "ACTIVE",
        sortBy: "firstName",
        sortOrder: "asc",
      });

      assert.equal(activeResult.pagination.total, 3);
      assert.ok(
        activeResult.items.every((customer) => customer.status === "ACTIVE"),
      );

      const archivedResult = await listCustomers(firstContext, {
        page: 1,
        limit: 20,
        status: "ARCHIVED",
        sortBy: "firstName",
        sortOrder: "asc",
      });

      assert.equal(archivedResult.pagination.total, 1);
      assert.ok(
        archivedResult.items.every(
          (customer) => customer.status === "ARCHIVED",
        ),
      );
    });

    await t.test(
      "retrieves customers without exposing another organization's data",
      async () => {
        const customer = await getCustomer(firstContext, primaryCustomerId);

        assert.equal(customer.id, primaryCustomerId);
        assert.equal(customer.organizationId, firstOrganization.id);
        assert.equal(customer._count.orders, 0);

        await assert.rejects(
          () => getCustomer(secondContext, primaryCustomerId),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "CUSTOMER_NOT_FOUND" &&
            error.statusCode === 404,
        );

        await assert.rejects(
          () =>
            updateValidatedCustomer(secondContext, primaryCustomerId, {
              firstName: "Unauthorized",
            }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "CUSTOMER_NOT_FOUND" &&
            error.statusCode === 404,
        );

        await assert.rejects(
          () => deleteCustomer(secondContext, primaryCustomerId),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "CUSTOMER_NOT_FOUND" &&
            error.statusCode === 404,
        );
      },
    );

    await t.test(
      "updates customer fields and clears nullable values",
      async () => {
        const updated = await updateValidatedCustomer(
          firstContext,
          primaryCustomerId,
          {
            firstName: "Jonathan",
            lastName: "Doe",
            company: null,
            email: null,
            phone: null,
            notes: null,
            status: "ARCHIVED",
          },
        );

        assert.equal(updated.firstName, "Jonathan");
        assert.equal(updated.lastName, "Doe");
        assert.equal(updated.company, null);
        assert.equal(updated.email, null);
        assert.equal(updated.phone, null);
        assert.equal(updated.notes, null);
        assert.equal(updated.status, "ARCHIVED");
      },
    );

    await t.test("rejects updates that violate email uniqueness", async () => {
      const customer = await createValidatedCustomer(firstContext, {
        firstName: "Unique",
        lastName: "Email",
        email: `unique-${uniqueId}@example.com`,
      });

      await assert.rejects(
        () =>
          updateValidatedCustomer(firstContext, customer.id, {
            email: `alice-${uniqueId}@example.com`,
          }),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "CUSTOMER_CONFLICT" &&
          error.statusCode === 409,
      );
    });

    await t.test("deletes customers without order history", async () => {
      const customer = await createValidatedCustomer(firstContext, {
        firstName: "Deletable",
        lastName: "Customer",
      });

      deletableCustomerId = customer.id;

      const result = await deleteCustomer(firstContext, deletableCustomerId);

      assert.equal(result.id, deletableCustomerId);
      assert.equal(result.deleted, true);

      await assert.rejects(
        () => getCustomer(firstContext, deletableCustomerId),
        (error: unknown) =>
          error instanceof ApiError && error.code === "CUSTOMER_NOT_FOUND",
      );
    });

    await t.test(
      "prevents deleting customers referenced by order history",
      async () => {
        const customer = await createValidatedCustomer(firstContext, {
          firstName: "Order",
          lastName: "History",
          email: `order-history-${uniqueId}@example.com`,
        });

        historyCustomerId = customer.id;

        const order = await prisma.order.create({
          data: {
            organizationId: firstOrganization.id,
            customerId: customer.id,
            orderNumber: `CUSTOMER-ORDER-${uniqueId}`,
            currencyCode: "INR",
            subtotal: "100.00",
            grandTotal: "100.00",
          },
        });

        orderId = order.id;

        await assert.rejects(
          () => deleteCustomer(firstContext, customer.id),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "CUSTOMER_HAS_ORDER_HISTORY" &&
            error.statusCode === 409 &&
            (error.details as { orderCount?: number })?.orderCount === 1,
        );

        const stillExists = await getCustomer(firstContext, customer.id);

        assert.equal(stillExists.id, customer.id);
        assert.equal(stillExists._count.orders, 1);
      },
    );

    await t.test("rejects retrieval of a nonexistent customer", async () => {
      await assert.rejects(
        () => getCustomer(firstContext, `missing-${uniqueId}`),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "CUSTOMER_NOT_FOUND" &&
          error.statusCode === 404,
      );
    });
  } finally {
    // Cleanup is restricted to organizations created by this test run.
    if (organizationIds.length > 0) {
      await prisma.payment.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });

      await prisma.orderItem.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });

      await prisma.order.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });

      await prisma.address.deleteMany({
        where: {
          organizationId: { in: organizationIds },
        },
      });

      await prisma.customer.deleteMany({
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
