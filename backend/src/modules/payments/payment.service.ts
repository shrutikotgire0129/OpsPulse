import { createHash } from "node:crypto";

import { Prisma } from "../../generated/prisma/client.js";

import { ApiError } from "../../lib/http/api-error.js";
import { prisma } from "../../lib/prisma.js";

import type {
  CreatePaymentInput,
  CreateRefundInput,
  ListPaymentsQuery,
  PaymentContext,
} from "./payment.types.js";

const MAX_DECIMAL_AMOUNT = new Prisma.Decimal("1000000000000000");

const PAYMENT_RESERVATION_MINUTES = 15;

// Razorpay is the first planned provider.
// Additional providers must be explicitly registered here.
const SUPPORTED_PAYMENT_PROVIDERS = new Set(["razorpay"]);

const paymentDetailsInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      currencyCode: true,
      grandTotal: true,
    },
  },
  refunds: {
    orderBy: {
      createdAt: "desc",
    },
  },
} satisfies Prisma.PaymentInclude;

function handlePaymentDatabaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError(
        409,
        "PAYMENT_CONFLICT",
        "A payment with conflicting idempotency or provider data already exists.",
      );
    }

    if (error.code === "P2003") {
      throw new ApiError(
        409,
        "PAYMENT_RELATION_CONFLICT",
        "The payment conflicts with an existing database relationship.",
      );
    }

    if (error.code === "P2025") {
      throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
    }
  }

  throw error;
}

function assertPaymentAmount(value: Prisma.Decimal): void {
  if (
    !value.isFinite() ||
    !value.greaterThan(0) ||
    value.greaterThanOrEqualTo(MAX_DECIMAL_AMOUNT) ||
    value.decimalPlaces() > 4
  ) {
    throw new ApiError(
      422,
      "INVALID_PAYMENT_AMOUNT",
      "Payment amount must be positive and fit within 15 integer digits and 4 decimal places.",
    );
  }
}

function assertRefundAmount(value: Prisma.Decimal): void {
  if (
    !value.isFinite() ||
    !value.greaterThan(0) ||
    value.greaterThanOrEqualTo(MAX_DECIMAL_AMOUNT) ||
    value.decimalPlaces() > 4
  ) {
    throw new ApiError(
      422,
      "INVALID_REFUND_AMOUNT",
      "Refund amount must be positive and fit within 15 integer digits and 4 decimal places.",
    );
  }
}

function createRefundRequestFingerprint(input: CreateRefundInput): string {
  const canonicalRequest = JSON.stringify({
    amount: new Prisma.Decimal(input.amount).toFixed(4),
    reason: input.reason ?? null,
  });

  return createHash("sha256").update(canonicalRequest).digest("hex");
}

function assertSameRefundRequest(
  existingFingerprint: string | null,
  requestedFingerprint: string,
): void {
  if (existingFingerprint !== requestedFingerprint) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "This idempotency key has already been used with a different refund request.",
    );
  }
}

async function findExistingIdempotentRefund(
  context: PaymentContext,
  idempotencyKey: string,
  fingerprint: string,
) {
  const existing = await prisma.paymentRefund.findUnique({
    where: {
      organizationId_idempotencyKey: {
        organizationId: context.organizationId,
        idempotencyKey,
      },
    },
  });

  if (!existing) {
    return null;
  }

  assertSameRefundRequest(existing.requestFingerprint, fingerprint);

  return existing;
}

function createRequestFingerprint(input: CreatePaymentInput): string {
  const canonicalRequest = JSON.stringify({
    orderId: input.orderId,
    amount: new Prisma.Decimal(input.amount).toFixed(4),
    method: input.method,
    provider: input.provider,
  });

  return createHash("sha256").update(canonicalRequest).digest("hex");
}

function assertSameIdempotentRequest(
  existingFingerprint: string | null,
  requestedFingerprint: string,
): void {
  if (existingFingerprint !== requestedFingerprint) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "This idempotency key has already been used with a different payment request.",
    );
  }
}

async function findExistingIdempotentPayment(
  context: PaymentContext,
  idempotencyKey: string,
  fingerprint: string,
) {
  const existing = await prisma.payment.findUnique({
    where: {
      organizationId_idempotencyKey: {
        organizationId: context.organizationId,
        idempotencyKey,
      },
    },
    include: paymentDetailsInclude,
  });

  if (!existing) {
    return null;
  }

  assertSameIdempotentRequest(existing.requestFingerprint, fingerprint);

  return existing;
}

/**
 * Creates a pending payment and reserves part of the order balance.
 *
 * The order row is locked before calculating the available balance.
 * This serializes concurrent payment attempts for the same order.
 *
 * No payment is marked successful here. Only a verified provider
 * event may transition a payment into a successful state.
 */
export async function createPayment(
  context: PaymentContext,
  input: CreatePaymentInput,
) {
  try {
    if (!SUPPORTED_PAYMENT_PROVIDERS.has(input.provider)) {
      throw new ApiError(
        422,
        "UNSUPPORTED_PAYMENT_PROVIDER",
        "The requested payment provider is not currently supported.",
      );
    }

    const amount = new Prisma.Decimal(input.amount);

    assertPaymentAmount(amount);

    const fingerprint = createRequestFingerprint(input);

    // Fast path for ordinary retries.
    const existing = await findExistingIdempotentPayment(
      context,
      input.idempotencyKey,
      fingerprint,
    );

    if (existing) {
      return existing;
    }

    return await prisma.$transaction(async (tx) => {
      /*
       * Serialize all payment reservations for this order.
       *
       * The organization filter is essential: the lock must never
       * be acquired for an order outside the trusted tenant context.
       */
      const lockedOrders = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Order"
        WHERE "id" = ${input.orderId}
          AND "organizationId" = ${context.organizationId}
        FOR UPDATE
      `;

      if (lockedOrders.length === 0) {
        throw new ApiError(
          404,
          "PAYMENT_ORDER_NOT_FOUND",
          "Order not found in this organization.",
        );
      }

      /*
       * Recheck idempotency inside the transaction.
       * This handles two concurrent requests using the same key.
       */
      const existingInsideTransaction = await tx.payment.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: context.organizationId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: paymentDetailsInclude,
      });

      if (existingInsideTransaction) {
        assertSameIdempotentRequest(
          existingInsideTransaction.requestFingerprint,
          fingerprint,
        );

        return existingInsideTransaction;
      }

      const order = await tx.order.findFirst({
        where: {
          id: input.orderId,
          organizationId: context.organizationId,
        },
        select: {
          id: true,
          status: true,
          currencyCode: true,
          grandTotal: true,
        },
      });

      if (!order) {
        throw new ApiError(
          404,
          "PAYMENT_ORDER_NOT_FOUND",
          "Order not found in this organization.",
        );
      }

      if (
        order.status === "DRAFT" ||
        order.status === "CANCELLED" ||
        order.status === "REFUNDED"
      ) {
        throw new ApiError(
          409,
          "ORDER_NOT_PAYABLE",
          "Payments cannot be created for draft, cancelled, or refunded orders.",
        );
      }

      const now = new Date();

      /*
       * Captured amount:
       * successful payments minus verified refunds.
       *
       * Pending refund requests do not release captured balance.
       */
      const capturedPayments = await tx.payment.aggregate({
        where: {
          organizationId: context.organizationId,
          orderId: order.id,
          status: {
            in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"],
          },
        },
        _sum: {
          amount: true,
          refundedAmount: true,
        },
      });

      const capturedGross = new Prisma.Decimal(
        capturedPayments._sum.amount?.toString() ?? "0",
      );

      const confirmedRefunds = new Prisma.Decimal(
        capturedPayments._sum.refundedAmount?.toString() ?? "0",
      );

      const netCaptured = capturedGross.minus(confirmedRefunds);

      /*
       * Active reservations:
       * pending or processing attempts that have not expired.
       *
       * A null expiry is treated as active for legacy records.
       */
      const activeReservations = await tx.payment.aggregate({
        where: {
          organizationId: context.organizationId,
          orderId: order.id,
          status: {
            in: ["PENDING", "PROCESSING"],
          },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        _sum: {
          amount: true,
        },
      });

      const reservedAmount = new Prisma.Decimal(
        activeReservations._sum.amount?.toString() ?? "0",
      );

      const grandTotal = new Prisma.Decimal(order.grandTotal.toString());

      const availableBalance = grandTotal
        .minus(netCaptured)
        .minus(reservedAmount);

      if (!availableBalance.greaterThan(0)) {
        throw new ApiError(
          409,
          "ORDER_ALREADY_PAID",
          "This order has no remaining payable balance.",
        );
      }

      if (amount.greaterThan(availableBalance)) {
        throw new ApiError(
          409,
          "PAYMENT_EXCEEDS_REMAINING_BALANCE",
          "The payment amount exceeds the remaining payable balance.",
          {
            currencyCode: order.currencyCode,
            availableBalance: availableBalance.toFixed(4),
          },
        );
      }

      const expiresAt = new Date(
        now.getTime() + PAYMENT_RESERVATION_MINUTES * 60 * 1000,
      );

      return tx.payment.create({
        data: {
          organizationId: context.organizationId,
          orderId: order.id,
          status: "PENDING",
          method: input.method,
          provider: input.provider,
          amount,
          currencyCode: order.currencyCode,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: fingerprint,
          expiresAt,
        },
        include: paymentDetailsInclude,
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Resolve a possible concurrent duplicate idempotency request.
      const existing = await findExistingIdempotentPayment(
        context,
        input.idempotencyKey,
        createRequestFingerprint(input),
      );

      if (existing) {
        return existing;
      }
    }

    handlePaymentDatabaseError(error);
  }
}

/**
 * Lists payments belonging only to the authenticated organization.
 */
export async function listPayments(
  context: PaymentContext,
  query: ListPaymentsQuery,
) {
  const where: Prisma.PaymentWhereInput = {
    organizationId: context.organizationId,
  };

  if (query.orderId) {
    where.orderId = query.orderId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.method) {
    where.method = query.method;
  }

  if (query.provider) {
    where.provider = query.provider;
  }

  const orderBy = {
    [query.sortBy]: query.sortOrder,
  } as Prisma.PaymentOrderByWithRelationInput;

  const skip = (query.page - 1) * query.limit;

  const [payments, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      orderBy: [orderBy, { id: "asc" }],
      skip,
      take: query.limit,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            currencyCode: true,
          },
        },
        _count: {
          select: {
            refunds: true,
          },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    items: payments,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasNextPage: skip + payments.length < total,
      hasPreviousPage: query.page > 1,
    },
  };
}

/**
 * Retrieves one payment without permitting cross-organization access.
 */
export async function getPayment(context: PaymentContext, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      organizationId: context.organizationId,
    },
    include: paymentDetailsInclude,
  });

  if (!payment) {
    throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
  }

  return payment;
}

/**
 * Creates a pending refund request.
 *
 * The payment row is locked before calculating the refundable
 * balance. This prevents concurrent requests from reserving
 * more than the remaining refundable amount.
 *
 * This function does not execute a real provider refund and
 * never marks a refund as successful.
 *
 * Only a verified provider event may confirm a refund.
 */
export async function createRefund(
  context: PaymentContext,
  paymentId: string,
  input: CreateRefundInput,
) {
  try {
    const amount = new Prisma.Decimal(input.amount);

    assertRefundAmount(amount);

    const fingerprint = createRefundRequestFingerprint(input);

    // Fast path for ordinary retries.
    const existing = await findExistingIdempotentRefund(
      context,
      input.idempotencyKey,
      fingerprint,
    );

    if (existing) {
      if (existing.paymentId !== paymentId) {
        throw new ApiError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "This idempotency key belongs to a different payment.",
        );
      }

      return existing;
    }

    return await prisma.$transaction(async (tx) => {
      /*
       * Serialize refund reservations for this payment.
       *
       * The organization filter ensures that the lock cannot
       * target a payment belonging to another organization.
       */
      const lockedPayments = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Payment"
        WHERE "id" = ${paymentId}
          AND "organizationId" = ${context.organizationId}
        FOR UPDATE
      `;

      if (lockedPayments.length === 0) {
        throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
      }

      /*
       * Recheck idempotency after acquiring the lock.
       */
      const existingInsideTransaction = await tx.paymentRefund.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: context.organizationId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });

      if (existingInsideTransaction) {
        assertSameRefundRequest(
          existingInsideTransaction.requestFingerprint,
          fingerprint,
        );

        if (existingInsideTransaction.paymentId !== paymentId) {
          throw new ApiError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "This idempotency key belongs to a different payment.",
          );
        }

        return existingInsideTransaction;
      }

      const payment = await tx.payment.findFirst({
        where: {
          id: paymentId,
          organizationId: context.organizationId,
        },
        select: {
          id: true,
          status: true,
          provider: true,
          amount: true,
          refundedAmount: true,
        },
      });

      if (!payment) {
        throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
      }

      if (
        payment.status !== "SUCCEEDED" &&
        payment.status !== "PARTIALLY_REFUNDED"
      ) {
        throw new ApiError(
          409,
          "PAYMENT_NOT_REFUNDABLE",
          "Only successful or partially refunded payments can be refunded.",
        );
      }

      if (!payment.provider) {
        throw new ApiError(
          409,
          "REFUND_PROVIDER_UNAVAILABLE",
          "This payment does not have a supported payment provider.",
        );
      }

      /*
       * Confirmed refunds are already represented by
       * Payment.refundedAmount.
       *
       * Pending and processing refunds reserve additional
       * refundable balance but do not change refundedAmount.
       */
      const pendingRefunds = await tx.paymentRefund.aggregate({
        where: {
          organizationId: context.organizationId,
          paymentId: payment.id,
          status: {
            in: ["PENDING", "PROCESSING"],
          },
        },
        _sum: {
          amount: true,
        },
      });

      const reservedRefundAmount = new Prisma.Decimal(
        pendingRefunds._sum.amount?.toString() ?? "0",
      );

      const paymentAmount = new Prisma.Decimal(payment.amount.toString());

      const confirmedRefundAmount = new Prisma.Decimal(
        payment.refundedAmount.toString(),
      );

      const availableRefundAmount = paymentAmount
        .minus(confirmedRefundAmount)
        .minus(reservedRefundAmount);

      if (!availableRefundAmount.greaterThan(0)) {
        throw new ApiError(
          409,
          "PAYMENT_ALREADY_REFUNDED",
          "This payment has no remaining refundable balance.",
        );
      }

      if (amount.greaterThan(availableRefundAmount)) {
        throw new ApiError(
          409,
          "REFUND_EXCEEDS_REMAINING_BALANCE",
          "The refund amount exceeds the remaining refundable balance.",
          {
            availableRefundAmount: availableRefundAmount.toFixed(4),
          },
        );
      }

      return tx.paymentRefund.create({
        data: {
          organizationId: context.organizationId,
          paymentId: payment.id,
          status: "PENDING",
          amount,
          provider: payment.provider,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: fingerprint,
          reason: input.reason,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Resolve a concurrent duplicate idempotency request.
      const existing = await findExistingIdempotentRefund(
        context,
        input.idempotencyKey,
        createRefundRequestFingerprint(input),
      );

      if (existing) {
        if (existing.paymentId !== paymentId) {
          throw new ApiError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "This idempotency key belongs to a different payment.",
          );
        }

        return existing;
      }
    }

    handlePaymentDatabaseError(error);
  }
}

/**
 * Retrieves a refund belonging to the specified payment
 * and authenticated organization.
 *
 * Both paymentId and organizationId are checked to prevent
 * cross-payment and cross-organization access.
 */
export async function getRefund(
  context: PaymentContext,
  paymentId: string,
  refundId: string,
) {
  const refund = await prisma.paymentRefund.findFirst({
    where: {
      id: refundId,
      paymentId,
      organizationId: context.organizationId,
    },
  });

  if (!refund) {
    throw new ApiError(404, "REFUND_NOT_FOUND", "Refund not found.");
  }

  return refund;
}
