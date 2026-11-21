import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelPaymentSchema,
  createPaymentSchema,
  createRefundSchema,
  listPaymentsQuerySchema,
  paymentIdParamsSchema,
} from "../src/modules/payments/payment.schema.js";

test("Payment request schemas", async (t) => {
  const validPayment = {
    orderId: "order_test123",
    amount: "125.5000",
    method: "UPI",
    provider: "razorpay",
    idempotencyKey: "payment-test-123",
  };

  await t.test("accepts a valid payment creation payload", () => {
    const result = createPaymentSchema.safeParse(validPayment);

    assert.equal(result.success, true);
  });

  await t.test("accepts decimal amounts with up to four places", () => {
    for (const amount of ["1", "10.5", "125.5000", "999999999999999.9999"]) {
      const result = createPaymentSchema.safeParse({
        ...validPayment,
        amount,
      });

      assert.equal(result.success, true, `Expected ${amount} to be valid`);
    }
  });

  await t.test("rejects zero payment amounts", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      amount: "0.0000",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects negative payment amounts", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      amount: "-10.00",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects amounts with more than four decimal places", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      amount: "10.12345",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects amounts exceeding Decimal(19,4)", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      amount: "1000000000000000",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects numeric amounts instead of decimal strings", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      amount: 125.5,
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects unsupported payment methods", () => {
    for (const method of ["CASH", "OTHER", "CRYPTO", "UNKNOWN"]) {
      const result = createPaymentSchema.safeParse({
        ...validPayment,
        method,
      });

      assert.equal(result.success, false);
    }
  });

  await t.test("accepts supported provider payment methods", () => {
    for (const method of [
      "CARD",
      "BANK_TRANSFER",
      "UPI",
      "NET_BANKING",
      "WALLET",
    ]) {
      const result = createPaymentSchema.safeParse({
        ...validPayment,
        method,
      });

      assert.equal(result.success, true);
    }
  });

  await t.test("rejects client-supplied payment status", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      status: "SUCCEEDED",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects client-supplied currency", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      currencyCode: "INR",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects client-supplied provider reference", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      providerReference: "pay_fake123",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects client-supplied organization ID", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      organizationId: "org_fake123",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an invalid provider identifier", () => {
    for (const provider of ["Razorpay", "razor pay", "123provider", ""]) {
      const result = createPaymentSchema.safeParse({
        ...validPayment,
        provider,
      });

      assert.equal(result.success, false);
    }
  });

  await t.test("rejects an unsupported provider identifier format", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      provider: "razorpay.com",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects short idempotency keys", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      idempotencyKey: "short",
    });

    assert.equal(result.success, false);
  });

  await t.test(
    "rejects idempotency keys containing unsupported characters",
    () => {
      const result = createPaymentSchema.safeParse({
        ...validPayment,
        idempotencyKey: "payment key with spaces",
      });

      assert.equal(result.success, false);
    },
  );

  await t.test("rejects missing required fields", () => {
    for (const input of [
      {},
      { orderId: validPayment.orderId },
      { orderId: validPayment.orderId, amount: validPayment.amount },
    ]) {
      const result = createPaymentSchema.safeParse(input);

      assert.equal(result.success, false);
    }
  });

  await t.test("rejects unexpected fields", () => {
    const result = createPaymentSchema.safeParse({
      ...validPayment,
      extraField: "not allowed",
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts valid payment ID parameters", () => {
    const result = paymentIdParamsSchema.safeParse({
      paymentId: "payment_test123",
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects missing payment ID parameters", () => {
    const result = paymentIdParamsSchema.safeParse({});

    assert.equal(result.success, false);
  });

  await t.test("accepts default payment list pagination", () => {
    const result = listPaymentsQuerySchema.safeParse({});

    assert.equal(result.success, true);

    if (result.success) {
      assert.equal(result.data.page, 1);
      assert.equal(result.data.limit, 20);
      assert.equal(result.data.sortBy, "createdAt");
      assert.equal(result.data.sortOrder, "desc");
    }
  });

  await t.test("accepts valid payment list filters", () => {
    const result = listPaymentsQuerySchema.safeParse({
      page: "2",
      limit: "50",
      orderId: "order_test123",
      status: "SUCCEEDED",
      method: "UPI",
      provider: "razorpay",
      sortBy: "amount",
      sortOrder: "asc",
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects invalid pagination values", () => {
    for (const query of [
      { page: "0" },
      { page: "-1" },
      { page: "1.5" },
      { limit: "0" },
      { limit: "101" },
      { limit: "invalid" },
    ]) {
      const result = listPaymentsQuerySchema.safeParse(query);

      assert.equal(result.success, false);
    }
  });

  await t.test("rejects unsupported payment list filters", () => {
    for (const query of [
      { status: "UNKNOWN" },
      { method: "CRYPTO" },
      { sortBy: "providerReference" },
      { sortOrder: "random" },
    ]) {
      const result = listPaymentsQuerySchema.safeParse(query);

      assert.equal(result.success, false);
    }
  });

  await t.test("rejects unexpected payment list query fields", () => {
    const result = listPaymentsQuerySchema.safeParse({
      page: "1",
      organizationId: "org_fake123",
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts cancellation without a reason", () => {
    const result = cancelPaymentSchema.safeParse({});

    assert.equal(result.success, true);
  });

  await t.test("accepts cancellation with a valid reason", () => {
    const result = cancelPaymentSchema.safeParse({
      reason: "Customer request",
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects an empty cancellation reason", () => {
    const result = cancelPaymentSchema.safeParse({
      reason: "   ",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an excessively long cancellation reason", () => {
    const result = cancelPaymentSchema.safeParse({
      reason: "a".repeat(1001),
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects unexpected cancellation fields", () => {
    const result = cancelPaymentSchema.safeParse({
      reason: "Customer request",
      status: "CANCELLED",
    });

    assert.equal(result.success, false);
  });
});

test("Refund request schemas", async (t) => {
  const validRefund = {
    amount: "45.5000",
    idempotencyKey: "refund-test-123",
    reason: "Customer requested a refund",
  };

  await t.test("accepts a valid refund request", () => {
    const result = createRefundSchema.safeParse(validRefund);

    assert.equal(result.success, true);
  });

  await t.test("accepts decimal amounts with up to four places", () => {
    for (const amount of ["1", "10.5", "45.5000", "999999999999999.9999"]) {
      const result = createRefundSchema.safeParse({
        ...validRefund,
        amount,
      });

      assert.equal(result.success, true, `Expected ${amount} to be valid`);
    }
  });

  await t.test("rejects zero refund amounts", () => {
    const result = createRefundSchema.safeParse({
      ...validRefund,
      amount: "0.0000",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects negative refund amounts", () => {
    const result = createRefundSchema.safeParse({
      ...validRefund,
      amount: "-10.00",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects more than four decimal places", () => {
    const result = createRefundSchema.safeParse({
      ...validRefund,
      amount: "10.12345",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects amounts exceeding Decimal(19,4)", () => {
    const result = createRefundSchema.safeParse({
      ...validRefund,
      amount: "1000000000000000",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects numeric amounts instead of decimal strings", () => {
    const result = createRefundSchema.safeParse({
      ...validRefund,
      amount: 45.5,
    });

    assert.equal(result.success, false);
  });

  await t.test("accepts a refund request without a reason", () => {
    const result = createRefundSchema.safeParse({
      amount: "25.00",
      idempotencyKey: "refund-test-456",
    });

    assert.equal(result.success, true);
  });

  await t.test("rejects an empty refund reason", () => {
    const result = createRefundSchema.safeParse({
      ...validRefund,
      reason: "   ",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects an excessively long refund reason", () => {
    const result = createRefundSchema.safeParse({
      ...validRefund,
      reason: "a".repeat(1001),
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects short idempotency keys", () => {
    const result = createRefundSchema.safeParse({
      ...validRefund,
      idempotencyKey: "short",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects unexpected payment status", () => {
    const result = createRefundSchema.safeParse({
      ...validRefund,
      status: "SUCCEEDED",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects client-supplied provider", () => {
    const result = createRefundSchema.safeParse({
      ...validRefund,
      provider: "razorpay",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects client-supplied provider reference", () => {
    const result = createRefundSchema.safeParse({
      ...validRefund,
      providerReference: "rfnd_fake123",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects client-supplied organization ID", () => {
    const result = createRefundSchema.safeParse({
      ...validRefund,
      organizationId: "org_fake123",
    });

    assert.equal(result.success, false);
  });

  await t.test("rejects unexpected fields", () => {
    const result = createRefundSchema.safeParse({
      ...validRefund,
      extraField: "not allowed",
    });

    assert.equal(result.success, false);
  });
});
