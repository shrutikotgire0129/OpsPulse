import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Prisma } from "../src/generated/prisma/client.js";
import { env } from "../src/config/env.js";
import { ApiError } from "../src/lib/http/api-error.js";
import { prisma } from "../src/lib/prisma.js";

import {
  createPayment,
  createRefund,
  getPayment,
  listPayments,
} from "../src/modules/payments/payment.service.js";

import {
  createPaymentSchema,
  createRefundSchema,
  listPaymentsQuerySchema,
} from "../src/modules/payments/payment.schema.js";

import type { PaymentContext } from "../src/modules/payments/payment.types.js";

function createValidatedPayment(context: PaymentContext, input: unknown) {
  return createPayment(context, createPaymentSchema.parse(input));
}

function createValidatedRefund(
  context: PaymentContext,
  paymentId: string,
  input: unknown,
) {
  return createRefund(context, paymentId, createRefundSchema.parse(input));
}

function listValidatedPayments(context: PaymentContext, input: unknown = {}) {
  return listPayments(context, listPaymentsQuerySchema.parse(input));
}

test("Payment service PostgreSQL integration", async (t) => {
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
  const orderIds: string[] = [];

  let firstContext: PaymentContext;
  let secondContext: PaymentContext;

  let firstOrganizationId = "";
  let secondOrganizationId = "";

  try {
    const firstOrganization = await prisma.organization.create({
      data: {
        name: `Payment Integration Organization A ${uniqueId}`,
        slug: `opspulse-payment-it-a-${uniqueId}`,
        currencyCode: "INR",
      },
    });

    organizationIds.push(firstOrganization.id);
    firstOrganizationId = firstOrganization.id;
    firstContext = { organizationId: firstOrganization.id };

    const secondOrganization = await prisma.organization.create({
      data: {
        name: `Payment Integration Organization B ${uniqueId}`,
        slug: `opspulse-payment-it-b-${uniqueId}`,
        currencyCode: "USD",
      },
    });

    organizationIds.push(secondOrganization.id);
    secondOrganizationId = secondOrganization.id;
    secondContext = { organizationId: secondOrganization.id };

    async function createTestOrder(
      organizationId: string,
      grandTotal: string,
      suffix: string,
    ) {
      const order = await prisma.order.create({
        data: {
          organizationId,
          orderNumber: `PAY-${uniqueId}-${suffix}`,
          status: "PENDING",
          currencyCode: organizationId === firstOrganizationId ? "INR" : "USD",
          subtotal: grandTotal,
          discountTotal: "0",
          taxTotal: "0",
          shippingTotal: "0",
          grandTotal,
        },
      });

      orderIds.push(order.id);
      return order;
    }

    function paymentInput(
      orderId: string,
      amount: string,
      idempotencyKey: string,
    ) {
      return {
        orderId,
        amount,
        method: "UPI" as const,
        provider: "razorpay",
        idempotencyKey,
      };
    }

    async function createSuccessfulPayment(
      context: PaymentContext,
      orderId: string,
      amount: string,
      suffix: string,
    ) {
      const payment = await createValidatedPayment(
        context,
        paymentInput(orderId, amount, `refund-payment-${suffix}-${uniqueId}`),
      );

      // Test fixture simulates a verified provider confirmation.
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCEEDED",
          paidAt: new Date(),
        },
      });

      return prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });
    }

    await t.test(
      "creates a pending payment using the order currency",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "basic",
        );

        const payment = await createValidatedPayment(
          firstContext,
          paymentInput(order.id, "40.0000", `basic-${uniqueId}`),
        );

        assert.equal(payment.organizationId, firstOrganizationId);
        assert.equal(payment.orderId, order.id);
        assert.equal(payment.amount.toString(), "40");
        assert.equal(payment.currencyCode, "INR");
        assert.equal(payment.status, "PENDING");
        assert.equal(payment.provider, "razorpay");
        assert.equal(payment.method, "UPI");
        assert.ok(payment.expiresAt);
        assert.equal(payment.paidAt, null);
        assert.equal(payment.providerReference, null);
      },
    );

    await t.test(
      "supports partial payments and prevents overpayment",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "partial",
        );

        const firstPayment = await createValidatedPayment(
          firstContext,
          paymentInput(order.id, "40.0000", `partial-a-${uniqueId}`),
        );

        // Test fixture simulates a verified provider confirmation.
        await prisma.payment.update({
          where: { id: firstPayment.id },
          data: {
            status: "SUCCEEDED",
            paidAt: new Date(),
          },
        });

        const secondPayment = await createValidatedPayment(
          firstContext,
          paymentInput(order.id, "60.0000", `partial-b-${uniqueId}`),
        );

        assert.equal(secondPayment.amount.toString(), "60");
        assert.equal(secondPayment.currencyCode, "INR");

        await assert.rejects(
          () =>
            createValidatedPayment(
              firstContext,
              paymentInput(order.id, "0.0001", `partial-c-${uniqueId}`),
            ),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "ORDER_ALREADY_PAID" &&
            error.statusCode === 409,
        );
      },
    );

    await t.test(
      "reserves pending payments and rejects excess reservations",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "reservation",
        );

        await createValidatedPayment(
          firstContext,
          paymentInput(order.id, "70.0000", `reserve-a-${uniqueId}`),
        );

        await assert.rejects(
          () =>
            createValidatedPayment(
              firstContext,
              paymentInput(order.id, "40.0000", `reserve-b-${uniqueId}`),
            ),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "PAYMENT_EXCEEDS_REMAINING_BALANCE" &&
            error.statusCode === 409,
        );
      },
    );

    await t.test(
      "releases an expired pending payment reservation",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "expired",
        );

        const expiredPayment = await createValidatedPayment(
          firstContext,
          paymentInput(order.id, "70.0000", `expired-a-${uniqueId}`),
        );

        await prisma.payment.update({
          where: { id: expiredPayment.id },
          data: {
            expiresAt: new Date(Date.now() - 60_000),
          },
        });

        const replacementPayment = await createValidatedPayment(
          firstContext,
          paymentInput(order.id, "70.0000", `expired-b-${uniqueId}`),
        );

        assert.equal(replacementPayment.status, "PENDING");
        assert.equal(replacementPayment.amount.toString(), "70");
      },
    );

    await t.test(
      "returns the existing payment for an identical idempotent retry",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "idempotent",
        );

        const input = paymentInput(
          order.id,
          "35.0000",
          `idempotent-${uniqueId}`,
        );

        const first = await createValidatedPayment(firstContext, input);
        const retry = await createValidatedPayment(firstContext, input);

        assert.equal(retry.id, first.id);
        assert.equal(retry.amount.toString(), "35");
      },
    );

    await t.test(
      "rejects reuse of an idempotency key with different payment data",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "idempotency-conflict",
        );

        const key = `conflict-${uniqueId}`;

        await createValidatedPayment(
          firstContext,
          paymentInput(order.id, "30.0000", key),
        );

        await assert.rejects(
          () =>
            createValidatedPayment(
              firstContext,
              paymentInput(order.id, "40.0000", key),
            ),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "IDEMPOTENCY_KEY_REUSED" &&
            error.statusCode === 409,
        );
      },
    );

    await t.test(
      "serializes concurrent payment attempts to prevent overpayment",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "concurrent",
        );

        const results = await Promise.allSettled([
          createValidatedPayment(
            firstContext,
            paymentInput(order.id, "60.0000", `concurrent-a-${uniqueId}`),
          ),
          createValidatedPayment(
            firstContext,
            paymentInput(order.id, "60.0000", `concurrent-b-${uniqueId}`),
          ),
        ]);

        const successful = results.filter(
          (result) => result.status === "fulfilled",
        );

        const rejected = results.filter(
          (result) => result.status === "rejected",
        );

        assert.equal(successful.length, 1);
        assert.equal(rejected.length, 1);

        const rejectedResult = rejected[0];

        assert.ok(rejectedResult);
        assert.equal(rejectedResult.status, "rejected");

        assert.ok(rejectedResult.reason instanceof ApiError);
        assert.equal(
          rejectedResult.reason.code,
          "PAYMENT_EXCEEDS_REMAINING_BALANCE",
        );

        const payments = await prisma.payment.findMany({
          where: {
            organizationId: firstOrganizationId,
            orderId: order.id,
          },
        });

        const reservedTotal = payments.reduce(
          (total, payment) => total.plus(payment.amount),
          new Prisma.Decimal(0),
        );

        assert.equal(reservedTotal.toString(), "60");
      },
    );

    await t.test(
      "does not expose another organization's payment or order",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "tenant",
        );

        const payment = await createValidatedPayment(
          firstContext,
          paymentInput(order.id, "25.0000", `tenant-${uniqueId}`),
        );

        await assert.rejects(
          () => getPayment(secondContext, payment.id),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "PAYMENT_NOT_FOUND" &&
            error.statusCode === 404,
        );

        await assert.rejects(
          () =>
            createValidatedPayment(
              secondContext,
              paymentInput(order.id, "10.0000", `foreign-${uniqueId}`),
            ),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "PAYMENT_ORDER_NOT_FOUND" &&
            error.statusCode === 404,
        );

        const foreignList = await listValidatedPayments(secondContext);

        assert.equal(foreignList.pagination.total, 0);
        assert.equal(foreignList.items.length, 0);
      },
    );

    await t.test(
      "lists payments with pagination and organization isolation",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "pagination",
        );

        await createValidatedPayment(
          firstContext,
          paymentInput(order.id, "10.0000", `page-a-${uniqueId}`),
        );

        await createValidatedPayment(
          firstContext,
          paymentInput(order.id, "20.0000", `page-b-${uniqueId}`),
        );

        const result = await listValidatedPayments(firstContext, {
          page: 1,
          limit: 1,
        });

        assert.equal(result.items.length, 1);
        assert.equal(result.pagination.page, 1);
        assert.equal(result.pagination.limit, 1);
        assert.ok(result.pagination.total >= 2);
        assert.equal(result.pagination.hasNextPage, true);
        assert.equal(result.pagination.hasPreviousPage, false);

        assert.ok(
          result.items.every(
            (payment) => payment.organizationId === firstOrganizationId,
          ),
        );
      },
    );

    await t.test(
      "rejects payments for orders belonging to another organization",
      async () => {
        const foreignOrder = await createTestOrder(
          secondOrganizationId,
          "100.0000",
          "foreign-order",
        );

        await assert.rejects(
          () =>
            createValidatedPayment(
              firstContext,
              paymentInput(
                foreignOrder.id,
                "20.0000",
                `foreign-order-${uniqueId}`,
              ),
            ),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "PAYMENT_ORDER_NOT_FOUND" &&
            error.statusCode === 404,
        );
      },
    );
    await t.test(
      "creates a pending refund without changing the confirmed refunded amount",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "refund-basic",
        );

        const payment = await createSuccessfulPayment(
          firstContext,
          order.id,
          "80.0000",
          "basic",
        );

        const refund = await createValidatedRefund(firstContext, payment.id, {
          amount: "30.0000",
          idempotencyKey: `refund-basic-${uniqueId}`,
          reason: "Customer requested a partial refund",
        });

        assert.equal(refund.organizationId, firstOrganizationId);
        assert.equal(refund.paymentId, payment.id);
        assert.equal(refund.status, "PENDING");
        assert.equal(refund.amount.toString(), "30");
        assert.equal(refund.provider, "razorpay");
        assert.equal(refund.providerReference, null);
        assert.equal(refund.processedAt, null);

        const refreshedPayment = await prisma.payment.findUniqueOrThrow({
          where: { id: payment.id },
        });

        assert.equal(refreshedPayment.refundedAmount.toString(), "0");
        assert.equal(refreshedPayment.status, "SUCCEEDED");
      },
    );

    await t.test(
      "reserves pending refunds and rejects excess refund requests",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "refund-reservation",
        );

        const payment = await createSuccessfulPayment(
          firstContext,
          order.id,
          "100.0000",
          "reservation",
        );

        await createValidatedRefund(firstContext, payment.id, {
          amount: "70.0000",
          idempotencyKey: `refund-reserve-a-${uniqueId}`,
        });

        await assert.rejects(
          () =>
            createValidatedRefund(firstContext, payment.id, {
              amount: "40.0000",
              idempotencyKey: `refund-reserve-b-${uniqueId}`,
            }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "REFUND_EXCEEDS_REMAINING_BALANCE" &&
            error.statusCode === 409,
        );

        const refreshedPayment = await prisma.payment.findUniqueOrThrow({
          where: { id: payment.id },
        });

        assert.equal(refreshedPayment.refundedAmount.toString(), "0");
      },
    );

    await t.test(
      "returns the existing refund for an identical idempotent retry",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "refund-idempotent",
        );

        const payment = await createSuccessfulPayment(
          firstContext,
          order.id,
          "60.0000",
          "idempotent",
        );

        const input = {
          amount: "25.0000",
          idempotencyKey: `refund-idempotent-${uniqueId}`,
          reason: "Duplicate item",
        };

        const first = await createValidatedRefund(
          firstContext,
          payment.id,
          input,
        );

        const retry = await createValidatedRefund(
          firstContext,
          payment.id,
          input,
        );

        assert.equal(retry.id, first.id);
        assert.equal(retry.paymentId, payment.id);
        assert.equal(retry.amount.toString(), "25");
      },
    );

    await t.test(
      "rejects reuse of a refund idempotency key with different data",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "refund-idempotency-conflict",
        );

        const payment = await createSuccessfulPayment(
          firstContext,
          order.id,
          "100.0000",
          "idempotency-conflict",
        );

        const key = `refund-conflict-${uniqueId}`;

        await createValidatedRefund(firstContext, payment.id, {
          amount: "20.0000",
          idempotencyKey: key,
          reason: "Original reason",
        });

        await assert.rejects(
          () =>
            createValidatedRefund(firstContext, payment.id, {
              amount: "30.0000",
              idempotencyKey: key,
              reason: "Changed reason",
            }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "IDEMPOTENCY_KEY_REUSED" &&
            error.statusCode === 409,
        );
      },
    );

    await t.test(
      "rejects refunds for payments that are not successful",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "refund-pending-payment",
        );

        const payment = await createValidatedPayment(
          firstContext,
          paymentInput(
            order.id,
            "50.0000",
            `refund-pending-payment-${uniqueId}`,
          ),
        );

        await assert.rejects(
          () =>
            createValidatedRefund(firstContext, payment.id, {
              amount: "10.0000",
              idempotencyKey: `refund-pending-${uniqueId}`,
            }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "PAYMENT_NOT_REFUNDABLE" &&
            error.statusCode === 409,
        );
      },
    );

    await t.test(
      "does not expose another organization's payment to refund requests",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "refund-tenant",
        );

        const payment = await createSuccessfulPayment(
          firstContext,
          order.id,
          "50.0000",
          "tenant",
        );

        await assert.rejects(
          () =>
            createValidatedRefund(secondContext, payment.id, {
              amount: "10.0000",
              idempotencyKey: `refund-foreign-${uniqueId}`,
            }),
          (error: unknown) =>
            error instanceof ApiError &&
            error.code === "PAYMENT_NOT_FOUND" &&
            error.statusCode === 404,
        );
      },
    );

    await t.test(
      "serializes concurrent refund requests to prevent over-refunding",
      async () => {
        const order = await createTestOrder(
          firstOrganizationId,
          "100.0000",
          "refund-concurrent",
        );

        const payment = await createSuccessfulPayment(
          firstContext,
          order.id,
          "100.0000",
          "concurrent",
        );

        const results = await Promise.allSettled([
          createValidatedRefund(firstContext, payment.id, {
            amount: "60.0000",
            idempotencyKey: `refund-concurrent-a-${uniqueId}`,
          }),
          createValidatedRefund(firstContext, payment.id, {
            amount: "60.0000",
            idempotencyKey: `refund-concurrent-b-${uniqueId}`,
          }),
        ]);

        const successful = results.filter(
          (result) => result.status === "fulfilled",
        );

        const rejected = results.filter(
          (result) => result.status === "rejected",
        );

        assert.equal(successful.length, 1);
        assert.equal(rejected.length, 1);

        const rejectedResult = rejected[0];

        assert.ok(rejectedResult);
        assert.equal(rejectedResult.status, "rejected");
        assert.ok(rejectedResult.reason instanceof ApiError);

        assert.equal(
          rejectedResult.reason.code,
          "REFUND_EXCEEDS_REMAINING_BALANCE",
        );

        const refunds = await prisma.paymentRefund.findMany({
          where: {
            organizationId: firstOrganizationId,
            paymentId: payment.id,
          },
        });

        const reservedTotal = refunds.reduce(
          (total, refund) => total.plus(refund.amount),
          new Prisma.Decimal(0),
        );

        assert.equal(reservedTotal.toString(), "60");

        const refreshedPayment = await prisma.payment.findUniqueOrThrow({
          where: { id: payment.id },
        });

        assert.equal(refreshedPayment.refundedAmount.toString(), "0");
      },
    );
  } finally {
    if (organizationIds.length > 0) {
      await prisma.paymentProviderEvent.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });

      await prisma.paymentRefund.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });

      await prisma.payment.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });

      await prisma.orderItem.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });

      await prisma.order.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });

      await prisma.organization.deleteMany({
        where: { id: { in: organizationIds } },
      });
    }

    await prisma.$disconnect();
  }
});
