
import assert from "node:assert/strict";
import test from "node:test";

import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
} from "../src/modules/orders/order.schema.js";

test("Order request schemas", async (t) => {
  await t.test("accepts a valid order creation payload", () => {
    const result = createOrderSchema.safeParse({
      customerId: "customer-123",
      items: [
        {
          productId: "product-123",
          quantity: "2",
          discountAmount: "100.00",
          taxAmount: "18.00",
        },
      ],
      shippingTotal: "50.00",
      billingAddress: {
        recipientName: "John Doe",
        line1: "123 Main Street",
        city: "Mumbai",
        postalCode: "400001",
        countryCode: "IN",
      },
      channel: "ONLINE",
      notes: "Deliver during business hours.",
    });

    assert.equal(result.success, true);
  });

  await t.test("accepts a minimal order creation payload", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
        },
      ],
    });

    assert.equal(result.success, true);

    if (result.success) {
      assert.equal(result.data.shippingTotal, "0.0000");
      assert.equal(result.data.items[0]?.discountAmount, "0.0000");
      assert.equal(result.data.items[0]?.taxAmount, "0.0000");
    }
  });

  await t.test("rejects an order without items", () => {
    const result = createOrderSchema.safeParse({
      items: [],
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a missing items field", () => {
    const result = createOrderSchema.safeParse({});

    assert.equal(result.success, false);
  });

  await t.test("rejects more than 100 order items", () => {
    const result = createOrderSchema.safeParse({
      items: Array.from({ length: 101 }, (_, index) => ({
        productId: `product-${index}`,
        quantity: "1",
      })),
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects duplicate products in an order", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
        },
        {
          productId: "product-123",
          quantity: "2",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts multiple distinct products", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
        },
        {
          productId: "product-456",
          quantity: "2",
        },
      ],
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects a missing product ID", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          quantity: "1",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an empty product ID", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: " ",
          quantity: "1",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts a positive fractional quantity", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "0.2500",
        },
      ],
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects a zero quantity", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "0",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a negative quantity", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "-1",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects more than four quantity decimal places", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1.12345",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects more than fifteen quantity integer digits", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1234567890123456",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts a zero line discount and zero tax", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
          discountAmount: "0",
          taxAmount: "0",
        },
      ],
    });

    assert.equal(result.success, true);
  });

  await t.test("accepts valid line discount and manual tax amounts", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "2",
          discountAmount: "100.50",
          taxAmount: "18.25",
        },
      ],
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects a negative line discount", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
          discountAmount: "-10",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a negative manual tax amount", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
          taxAmount: "-10",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects more than four decimal places in a discount", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
          discountAmount: "10.12345",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects more than four decimal places in tax", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
          taxAmount: "10.12345",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects more than fifteen integer digits in money", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
          taxAmount: "1234567890123456",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a non-decimal shipping amount", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
        },
      ],
      shippingTotal: "free",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a negative shipping amount", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
        },
      ],
      shippingTotal: "-10",
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts a valid billing address", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
        },
      ],
      billingAddress: {
        line1: "123 Main Street",
        city: "Pune",
        postalCode: "411001",
        countryCode: "IN",
      },
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects an invalid country code", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
        },
      ],
      shippingAddress: {
        line1: "123 Main Street",
        city: "Pune",
        postalCode: "411001",
        countryCode: "IND",
      },
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an incomplete address", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
        },
      ],
      billingAddress: {
        line1: "123 Main Street",
        countryCode: "IN",
      },
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects unknown address fields", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
        },
      ],
      billingAddress: {
        line1: "123 Main Street",
        city: "Pune",
        postalCode: "411001",
        countryCode: "IN",
        organizationId: "untrusted-organization",
      },
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects client-supplied financial totals", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
        },
      ],
      subtotal: "100",
      grandTotal: "100",
      discountTotal: "0",
      taxTotal: "0",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects client-supplied product prices", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
          unitPrice: "100",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects client-supplied organization IDs", () => {
    const result = createOrderSchema.safeParse({
      organizationId: "untrusted-organization",
      items: [
        {
          productId: "product-123",
          quantity: "1",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an empty order creation payload", () => {
    const result = createOrderSchema.safeParse({
      items: [
        {
          productId: "product-123",
          quantity: "1",
        },
      ],
      channel: " ",
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts a valid order ID parameter", () => {
    const result = orderIdParamsSchema.safeParse({
      orderId: "order-123",
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects an empty order ID parameter", () => {
    const result = orderIdParamsSchema.safeParse({
      orderId: " ",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects unknown order ID parameter fields", () => {
    const result = orderIdParamsSchema.safeParse({
      orderId: "order-123",
      organizationId: "untrusted-organization",
    });

    assert.equal(result.success, false);
  });

  await t.test("applies default order list query values", () => {
    const result = listOrdersQuerySchema.safeParse({});

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
    const result = listOrdersQuerySchema.safeParse({
      page: "2",
      limit: "50",
    });

    assert.equal(result.success, true);

    if (result.success) {
      assert.equal(result.data.page, 2);
      assert.equal(result.data.limit, 50);
    }
  });

  await t.test("accepts valid order filters and sorting", () => {
    const result = listOrdersQuerySchema.safeParse({
      page: "3",
      limit: "25",
      search: "ORD-123",
      customerId: "customer-123",
      status: "PROCESSING",
      sortBy: "grandTotal",
      sortOrder: "asc",
    });

    assert.equal(result.success, true);
  });

  await t.test("accepts every supported order status", () => {
    const statuses = [
      "DRAFT",
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
      "REFUNDED",
    ];

    for (const status of statuses) {
      const result = listOrdersQuerySchema.safeParse({ status });
      assert.equal(result.success, true, `Expected ${status} to be accepted`);
    }
  });

  await t.test("rejects an unsupported order status", () => {
    const result = listOrdersQuerySchema.safeParse({
      status: "COMPLETED",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a page number below one", () => {
    const result = listOrdersQuerySchema.safeParse({
      page: "0",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects a list limit above 100", () => {
    const result = listOrdersQuerySchema.safeParse({
      limit: "101",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an unsupported sort field", () => {
    const result = listOrdersQuerySchema.safeParse({
      sortBy: "customerId",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects unknown order list query fields", () => {
    const result = listOrdersQuerySchema.safeParse({
      page: "1",
      organizationId: "untrusted-organization",
    });

    assert.equal(result.success, false);
  });
});
