
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { env } from "../src/config/env.js";
import { ApiError } from "../src/lib/http/api-error.js";
import { prisma } from "../src/lib/prisma.js";

import type { OrderContext } from "../src/modules/orders/order.types.js";

import {
  createOrder,
  getOrder,
  listOrders,
} from "../src/modules/orders/order.service.js";

import {
  createOrderSchema,
  listOrdersQuerySchema,
} from "../src/modules/orders/order.schema.js";

function createValidatedOrder(context: OrderContext, input: unknown) {
  return createOrder(context, createOrderSchema.parse(input));
}

function listValidatedOrders(context: OrderContext, input: unknown = {}) {
  return listOrders(context, listOrdersQuerySchema.parse(input));
}

test("Order service PostgreSQL integration", async (t) => {
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

  let firstContext: OrderContext;
  let secondContext: OrderContext;

  let firstOrganizationId = "";
  let secondOrganizationId = "";

  let primaryCustomerId = "";
  let secondCustomerId = "";

  let primaryProductId = "";
  let secondProductId = "";
  let precisionProductId = "";
  let archivedProductId = "";
  let foreignProductId = "";
  let foreignCurrencyProductId = "";

  const createdOrderIds: string[] = [];

  try {
    const firstOrganization = await prisma.organization.create({
      data: {
        name: `Order Integration Organization A ${uniqueId}`,
        slug: `opspulse-order-it-a-${uniqueId}`,
        currencyCode: "INR",
      },
    });

    organizationIds.push(firstOrganization.id);
    firstOrganizationId = firstOrganization.id;

    const secondOrganization = await prisma.organization.create({
      data: {
        name: `Order Integration Organization B ${uniqueId}`,
        slug: `opspulse-order-it-b-${uniqueId}`,
        currencyCode: "USD",
      },
    });

    organizationIds.push(secondOrganization.id);
    secondOrganizationId = secondOrganization.id;

    firstContext = { organizationId: firstOrganization.id };
    secondContext = { organizationId: secondOrganization.id };

    const primaryCustomer = await prisma.customer.create({
      data: {
        organizationId: firstOrganization.id,
        firstName: "Order",
        lastName: "Integration Customer",
        email: `order-customer-${uniqueId}@example.com`,
        status: "ACTIVE",
      },
    });

    primaryCustomerId = primaryCustomer.id;

    const secondCustomer = await prisma.customer.create({
      data: {
        organizationId: secondOrganization.id,
        firstName: "Foreign",
        lastName: "Customer",
        email: `foreign-customer-${uniqueId}@example.com`,
        status: "ACTIVE",
      },
    });

    secondCustomerId = secondCustomer.id;

    const primaryProduct = await prisma.product.create({
      data: {
        organizationId: firstOrganization.id,
        name: "Integration Product One",
        slug: `integration-product-one-${uniqueId}`,
        sku: `ORDER-SKU-ONE-${uniqueId}`,
        price: "100.0000",
        currencyCode: "INR",
        status: "ACTIVE",
      },
    });

    primaryProductId = primaryProduct.id;

    const secondProduct = await prisma.product.create({
      data: {
        organizationId: firstOrganization.id,
        name: "Integration Product Two",
        slug: `integration-product-two-${uniqueId}`,
        sku: `ORDER-SKU-TWO-${uniqueId}`,
        price: "50.0000",
        currencyCode: "INR",
        status: "ACTIVE",
      },
    });

    secondProductId = secondProduct.id;

    const precisionProduct = await prisma.product.create({
      data: {
        organizationId: firstOrganization.id,
        name: "Precision Test Product",
        slug: `precision-product-${uniqueId}`,
        price: "0.0001",
        currencyCode: "INR",
        status: "ACTIVE",
      },
    });

    precisionProductId = precisionProduct.id;

    const archivedProduct = await prisma.product.create({
      data: {
        organizationId: firstOrganization.id,
        name: "Archived Integration Product",
        slug: `archived-product-${uniqueId}`,
        price: "100.0000",
        currencyCode: "INR",
        status: "ARCHIVED",
      },
    });

    archivedProductId = archivedProduct.id;

    const foreignProduct = await prisma.product.create({
      data: {
        organizationId: secondOrganization.id,
        name: "Foreign Organization Product",
        slug: `foreign-product-${uniqueId}`,
        price: "100.0000",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    });

    foreignProductId = foreignProduct.id;

    const foreignCurrencyProduct = await prisma.product.create({
      data: {
        organizationId: firstOrganization.id,
        name: "Foreign Currency Product",
        slug: `foreign-currency-product-${uniqueId}`,
        price: "100.0000",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    });

    foreignCurrencyProductId = foreignCurrencyProduct.id;

    await t.test(
      "creates an order with trusted product data and correct financial totals",
      async () => {
        const order = await createValidatedOrder(firstContext, {
          customerId: primaryCustomerId,
          items: [
            {
              productId: primaryProductId,
              quantity: "2.0000",
              discountAmount: "10.0000",
              taxAmount: "18.0000",
            },
            {
              productId: secondProductId,
              quantity: "3.0000",
              discountAmount: "5.0000",
              taxAmount: "4.0000",
            },
          ],
          shippingTotal: "25.0000",
          channel: "ONLINE",
          notes: "Order integration test.",
        });

        createdOrderIds.push(order.id);

        assert.equal(order.organizationId, firstOrganizationId);
        assert.equal(order.customerId, primaryCustomerId);
        assert.equal(order.currencyCode, "INR");
        assert.equal(order.status, "PENDING");

        assert.equal(order.subtotal.toString(), "350");
        assert.equal(order.discountTotal.toString(), "15");
        assert.equal(order.taxTotal.toString(), "22");
        assert.equal(order.shippingTotal.toString(), "25");
        assert.equal(order.grandTotal.toString(), "382");

        assert.equal(order.items.length, 2);

        assert.equal(order.items[0]?.lineNumber, 1);
        assert.equal(
          order.items[0]?.productName,
          "Integration Product One",
        );
        assert.equal(
          order.items[0]?.sku,
          `ORDER-SKU-ONE-${uniqueId}`,
        );
        assert.equal(order.items[0]?.unitPrice.toString(), "100");
        assert.equal(order.items[0]?.quantity.toString(), "2");
        assert.equal(order.items[0]?.discountAmount.toString(), "10");
        assert.equal(order.items[0]?.taxAmount.toString(), "18");
        assert.equal(order.items[0]?.lineTotal.toString(), "208");

        assert.equal(order.items[1]?.lineNumber, 2);
        assert.equal(
          order.items[1]?.productName,
          "Integration Product Two",
        );
        assert.equal(order.items[1]?.unitPrice.toString(), "50");
        assert.equal(order.items[1]?.lineTotal.toString(), "149");

        assert.equal(order.channel, "ONLINE");
        assert.equal(order.notes, "Order integration test.");
      },
    );

    await t.test(
      "creates an order with default financial values when omitted",
      async () => {
        const order = await createValidatedOrder(firstContext, {
          items: [
            {
              productId: primaryProductId,
              quantity: "1.0000",
            },
          ],
        });

        createdOrderIds.push(order.id);

        assert.equal(order.customerId, null);
        assert.equal(order.subtotal.toString(), "100");
        assert.equal(order.discountTotal.toString(), "0");
        assert.equal(order.taxTotal.toString(), "0");
        assert.equal(order.shippingTotal.toString(), "0");
        assert.equal(order.grandTotal.toString(), "100");

        assert.equal(order.items[0]?.discountAmount.toString(), "0");
        assert.equal(order.items[0]?.taxAmount.toString(), "0");
      },
    );

    await t.test(
      "rejects a line discount greater than the gross line amount",
      async () => {
        await assert.rejects(
          () =>
            createValidatedOrder(firstContext, {
              items: [
                {
                  productId: primaryProductId,
                  quantity: "1.0000",
                  discountAmount: "100.0001",
                },
              ],
            }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "DISCOUNT_EXCEEDS_LINE_AMOUNT" &&
            error.statusCode === 422,
        );
      },
    );

    await t.test(
      "rejects a gross line amount with more than four decimal places",
      async () => {
        await assert.rejects(
          () =>
            createValidatedOrder(firstContext, {
              items: [
                {
                  productId: precisionProductId,
                  quantity: "0.0001",
                },
              ],
            }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "INVALID_ORDER_AMOUNT" &&
            error.statusCode === 422,
        );
      },
    );

    await t.test(
      "rejects products belonging to another organization",
      async () => {
        await assert.rejects(
          () =>
            createValidatedOrder(firstContext, {
              items: [
                {
                  productId: foreignProductId,
                  quantity: "1.0000",
                },
              ],
            }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "ORDER_PRODUCT_NOT_FOUND" &&
            error.statusCode === 404,
        );
      },
    );

    await t.test("rejects archived products", async () => {
      await assert.rejects(
        () =>
          createValidatedOrder(firstContext, {
            items: [
              {
                productId: archivedProductId,
                quantity: "1.0000",
              },
            ],
          }),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "ORDER_PRODUCT_NOT_FOUND" &&
          error.statusCode === 404,
      );
    });

    await t.test("rejects products using another currency", async () => {
      await assert.rejects(
        () =>
          createValidatedOrder(firstContext, {
            items: [
              {
                productId: foreignCurrencyProductId,
                quantity: "1.0000",
              },
            ],
          }),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "PRODUCT_CURRENCY_MISMATCH" &&
          error.statusCode === 409,
      );
    });

    await t.test(
      "rejects customers belonging to another organization",
      async () => {
        await assert.rejects(
          () =>
            createValidatedOrder(firstContext, {
              customerId: secondCustomerId,
              items: [
                {
                  productId: primaryProductId,
                  quantity: "1.0000",
                },
              ],
            }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "CUSTOMER_NOT_FOUND" &&
            error.statusCode === 404,
        );
      },
    );

    await t.test("rejects archived customers", async () => {
      const archivedCustomer = await prisma.customer.create({
        data: {
          organizationId: firstOrganizationId,
          firstName: "Archived",
          lastName: "Integration Customer",
          email: `archived-${uniqueId}@example.com`,
          status: "ARCHIVED",
        },
      });

      await assert.rejects(
        () =>
          createValidatedOrder(firstContext, {
            customerId: archivedCustomer.id,
            items: [
              {
                productId: primaryProductId,
                quantity: "1.0000",
              },
            ],
          }),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "CUSTOMER_INACTIVE" &&
          error.statusCode === 409,
      );
    });

    await t.test(
      "retrieves orders without exposing another organization's data",
      async () => {
        const order = await createValidatedOrder(firstContext, {
          customerId: primaryCustomerId,
          items: [
            {
              productId: primaryProductId,
              quantity: "1.0000",
            },
          ],
        });

        createdOrderIds.push(order.id);

        const retrieved = await getOrder(firstContext, order.id);

        assert.equal(retrieved.id, order.id);
        assert.equal(retrieved.organizationId, firstOrganizationId);
        assert.equal(retrieved.items.length, 1);

        await assert.rejects(
          () => getOrder(secondContext, order.id),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "ORDER_NOT_FOUND" &&
            error.statusCode === 404,
        );
      },
    );

    await t.test(
      "lists orders with pagination and organization isolation",
      async () => {
        const firstPage = await listValidatedOrders(firstContext, {
          page: 1,
          limit: 1,
          sortBy: "createdAt",
          sortOrder: "asc",
        });

        assert.equal(firstPage.pagination.page, 1);
        assert.equal(firstPage.pagination.limit, 1);
        assert.equal(firstPage.pagination.total, 3);
        assert.equal(firstPage.pagination.totalPages, 3);
        assert.equal(firstPage.pagination.hasNextPage, true);
        assert.equal(firstPage.pagination.hasPreviousPage, false);
        assert.equal(firstPage.items.length, 1);

        assert.ok(
          firstPage.items.every(
            (order) => order.organizationId === firstOrganizationId,
          ),
        );

        const secondPage = await listValidatedOrders(firstContext, {
          page: 2,
          limit: 1,
          sortBy: "createdAt",
          sortOrder: "asc",
        });

        assert.equal(secondPage.items.length, 1);
        assert.equal(secondPage.pagination.hasPreviousPage, true);
        assert.equal(secondPage.pagination.hasNextPage, true);

        const thirdPage = await listValidatedOrders(firstContext, {
          page: 3,
          limit: 1,
          sortBy: "createdAt",
          sortOrder: "asc",
        });

        assert.equal(thirdPage.items.length, 1);
        assert.equal(thirdPage.pagination.hasPreviousPage, true);
        assert.equal(thirdPage.pagination.hasNextPage, false);

        const otherOrganizationOrders = await listValidatedOrders(
          secondContext,
        );

        assert.equal(otherOrganizationOrders.pagination.total, 0);
        assert.equal(otherOrganizationOrders.items.length, 0);
      },
    );

    await t.test("filters orders by customer and status", async () => {
      const customerOrders = await listValidatedOrders(firstContext, {
        customerId: primaryCustomerId,
      });

      assert.equal(customerOrders.pagination.total, 2);
      assert.ok(
        customerOrders.items.every(
          (order) => order.customerId === primaryCustomerId,
        ),
      );

      const pendingOrders = await listValidatedOrders(firstContext, {
        status: "PENDING",
      });

      assert.equal(pendingOrders.pagination.total, 3);
      assert.ok(
        pendingOrders.items.every((order) => order.status === "PENDING"),
      );
    });

    await t.test("searches orders by order number and customer name", async () => {
      const order = await createValidatedOrder(firstContext, {
        customerId: primaryCustomerId,
        items: [
          {
            productId: primaryProductId,
            quantity: "1.0000",
          },
        ],
      });

      createdOrderIds.push(order.id);

      const orderNumberResult = await listValidatedOrders(firstContext, {
        search: order.orderNumber,
      });

      assert.equal(orderNumberResult.pagination.total, 1);
      assert.equal(orderNumberResult.items[0]?.id, order.id);

      const customerNameResult = await listValidatedOrders(firstContext, {
        search: "Integration Customer",
      });

      assert.equal(customerNameResult.pagination.total, 3);
      assert.ok(
        customerNameResult.items.every(
          (item) => item.customerId === primaryCustomerId,
        ),
      );
    });

    await t.test("returns not found for a nonexistent order", async () => {
      await assert.rejects(
        () => getOrder(firstContext, `missing-${uniqueId}`),
        (error: unknown) =>
          error instanceof ApiError &&
          error.code === "ORDER_NOT_FOUND" &&
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
