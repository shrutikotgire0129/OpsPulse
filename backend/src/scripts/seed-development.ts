import "dotenv/config";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

const EXPECTED_DATABASE = "opspulse";
const ORGANIZATION_ID = "cmwxmjex4000154ixvbo2fsgw";
const ORGANIZATION_SLUG = "shruti-s-organization";

const products = [
  {
    id: "opsseed_product_01",
    name: "Wireless Headphones",
    slug: "opsseed-wireless-headphones",
    sku: "OPS-SEED-001",
    price: "129.0000",
    cost: "72.0000",
  },
  {
    id: "opsseed_product_02",
    name: "Mechanical Keyboard",
    slug: "opsseed-mechanical-keyboard",
    sku: "OPS-SEED-002",
    price: "89.0000",
    cost: "48.0000",
  },
  {
    id: "opsseed_product_03",
    name: "USB-C Docking Station",
    slug: "opsseed-usb-c-dock",
    sku: "OPS-SEED-003",
    price: "159.0000",
    cost: "96.0000",
  },
  {
    id: "opsseed_product_04",
    name: "Portable SSD",
    slug: "opsseed-portable-ssd",
    sku: "OPS-SEED-004",
    price: "109.0000",
    cost: "67.0000",
  },
];

const customers = [
  ["opsseed_customer_01", "Aarav", "Sharma"],
  ["opsseed_customer_02", "Diya", "Patel"],
  ["opsseed_customer_03", "Ishaan", "Mehta"],
  ["opsseed_customer_04", "Ananya", "Rao"],
  ["opsseed_customer_05", "Kabir", "Verma"],
  ["opsseed_customer_06", "Myra", "Nair"],
  ["opsseed_customer_07", "Arjun", "Desai"],
  ["opsseed_customer_08", "Saanvi", "Iyer"],
] as const;

const amounts = [
  "129.0000",
  "89.0000",
  "159.0000",
  "109.0000",
  "258.0000",
  "178.0000",
  "159.0000",
  "218.0000",
  "129.0000",
  "89.0000",
  "318.0000",
  "109.0000",
  "178.0000",
  "159.0000",
  "129.0000",
  "218.0000",
  "89.0000",
  "109.0000",
  "159.0000",
  "129.0000",
  "178.0000",
  "89.0000",
  "109.0000",
  "159.0000",
];

const channels = ["ONLINE", "POS", "MARKETPLACE"] as const;

const paymentMethods = [
  "CARD",
  "BANK_TRANSFER",
  "WALLET",
  "CARD",
  "OTHER",
] as const;

function dateDaysAgo(daysAgo: number): Date {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

function assertSafeEnvironment(): void {
  if (env.NODE_ENV !== "development") {
    throw new Error(
      `Refusing to seed: NODE_ENV must be development, received ${env.NODE_ENV}.`,
    );
  }

  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.replace(/^\/+/, ""),
  );

  if (databaseName !== EXPECTED_DATABASE) {
    throw new Error(
      `Refusing to seed: expected database "${EXPECTED_DATABASE}", received "${databaseName}".`,
    );
  }
}

async function main(): Promise<void> {
  assertSafeEnvironment();

  const organization = await prisma.organization.findUnique({
    where: { id: ORGANIZATION_ID },
    select: {
      id: true,
      slug: true,
      currencyCode: true,
      timezone: true,
    },
  });

  if (
    !organization ||
    organization.slug !== ORGANIZATION_SLUG ||
    organization.currencyCode !== "USD" ||
    organization.timezone !== "UTC"
  ) {
    throw new Error(
      "Refusing to seed: the expected development organization was not found or its configuration has changed.",
    );
  }

  console.log("Safety checks passed.");
  console.log(`Database: ${EXPECTED_DATABASE}`);
  console.log(`Organization: ${organization.slug}`);
  console.log("Starting idempotent development seed...");

  await prisma.$transaction(
    async (tx) => {
      for (const product of products) {
        await tx.product.upsert({
          where: {
            organizationId_slug: {
              organizationId: ORGANIZATION_ID,
              slug: product.slug,
            },
          },
          create: {
            ...product,
            organizationId: ORGANIZATION_ID,
            description: "OpsPulse development demonstration product.",
            currencyCode: "USD",
            status: "ACTIVE",
          },
          update: {
            name: product.name,
            price: product.price,
            cost: product.cost,
            status: "ACTIVE",
          },
        });
      }

      for (const [id, firstName, lastName] of customers) {
        await tx.customer.upsert({
          where: {
            organizationId_email: {
              organizationId: ORGANIZATION_ID,
              email: `${id}@example.test`,
            },
          },
          create: {
            id,
            organizationId: ORGANIZATION_ID,
            firstName,
            lastName,
            company: `${lastName} Trading`,
            email: `${id}@example.test`,
            status: "ACTIVE",
          },
          update: {
            firstName,
            lastName,
            status: "ACTIVE",
          },
        });
      }

      for (let index = 0; index < amounts.length; index += 1) {
        const orderNumber = `OPS-SEED-2026-${String(index + 1).padStart(3, "0")}`;
        const orderId = `opsseed_order_${String(index + 1).padStart(2, "0")}`;
        const paymentId = `opsseed_payment_${String(index + 1).padStart(2, "0")}`;

        const amount = amounts[index]!;
        const product = products[index % products.length]!;
        const customer = customers[index % customers.length]!;
        const placedAt = dateDaysAgo(1 + ((index * 7) % 28));

        const isCaptured = index < 18;
        const isPending = index === 18 || index === 19;
        const isFailed = index === 20 || index === 21;
        const isCancelled = index === 22 || index === 23;

        const isPartiallyRefunded = index === 4;
        const isFullyRefunded = index === 9;

        const orderStatus = isCancelled
          ? "CANCELLED"
          : isPending || isFailed
            ? "PENDING"
            : isFullyRefunded
              ? "REFUNDED"
              : index % 3 === 0
                ? "DELIVERED"
                : index % 3 === 1
                  ? "SHIPPED"
                  : "PROCESSING";

        const paymentStatus = isPartiallyRefunded
          ? "PARTIALLY_REFUNDED"
          : isFullyRefunded
            ? "REFUNDED"
            : isCaptured
              ? "SUCCEEDED"
              : isPending
                ? "PENDING"
                : isFailed
                  ? "FAILED"
                  : "CANCELLED";

        const refundedAmount = isPartiallyRefunded
          ? "40.0000"
          : isFullyRefunded
            ? amount
            : "0.0000";

        const paidAt = isCaptured ? placedAt : null;

        await tx.order.upsert({
          where: {
            organizationId_orderNumber: {
              organizationId: ORGANIZATION_ID,
              orderNumber,
            },
          },
          create: {
            id: orderId,
            organizationId: ORGANIZATION_ID,
            customerId: customer[0],
            orderNumber,
            status: orderStatus,
            currencyCode: "USD",
            subtotal: amount,
            discountTotal: "0.0000",
            taxTotal: "0.0000",
            shippingTotal: "0.0000",
            grandTotal: amount,
            channel: channels[index % channels.length],
            placedAt,
            fulfilledAt:
              orderStatus === "DELIVERED" || orderStatus === "SHIPPED"
                ? dateDaysAgo(Math.max(0, 1 + ((index * 7) % 28) - 1))
                : null,
          },
          update: {
            customerId: customer[0],
            status: orderStatus,
            grandTotal: amount,
            channel: channels[index % channels.length],
            placedAt,
          },
        });

        await tx.orderItem.upsert({
          where: {
            organizationId_orderId_lineNumber: {
              organizationId: ORGANIZATION_ID,
              orderId,
              lineNumber: 1,
            },
          },
          create: {
            organizationId: ORGANIZATION_ID,
            orderId,
            productId: product.id,
            lineNumber: 1,
            productName: product.name,
            sku: product.sku,
            quantity: "1.0000",
            unitPrice: amount,
            discountAmount: "0.0000",
            taxAmount: "0.0000",
            lineTotal: amount,
          },
          update: {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unitPrice: amount,
            lineTotal: amount,
          },
        });

        await tx.payment.upsert({
          where: {
            organizationId_idempotencyKey: {
              organizationId: ORGANIZATION_ID,
              idempotencyKey: `opsseed-payment-${index + 1}`,
            },
          },
          create: {
            id: paymentId,
            organizationId: ORGANIZATION_ID,
            orderId,
            status: paymentStatus,
            method: paymentMethods[index % paymentMethods.length],
            provider: "OpsPulse Demo",
            providerReference: `OPS-SEED-REF-${index + 1}`,
            idempotencyKey: `opsseed-payment-${index + 1}`,
            amount,
            refundedAmount,
            currencyCode: "USD",
            paidAt,
            failedAt: isFailed ? placedAt : null,
            failureReason: isFailed ? "Demonstration payment failure." : null,
          },
          update: {
            orderId,
            status: paymentStatus,
            amount,
            refundedAmount,
            paidAt,
            failedAt: isFailed ? placedAt : null,
          },
        });

        if (isPartiallyRefunded || isFullyRefunded) {
          const refundId = isPartiallyRefunded
            ? "opsseed_refund_partial"
            : "opsseed_refund_full";

          const refundAmount = isPartiallyRefunded ? "40.0000" : amount;

          await tx.paymentRefund.upsert({
            where: {
              organizationId_idempotencyKey: {
                organizationId: ORGANIZATION_ID,
                idempotencyKey: `opsseed-refund-${isPartiallyRefunded ? "partial" : "full"}`,
              },
            },
            create: {
              id: refundId,
              organizationId: ORGANIZATION_ID,
              paymentId,
              status: "SUCCEEDED",
              amount: refundAmount,
              idempotencyKey: `opsseed-refund-${isPartiallyRefunded ? "partial" : "full"}`,
              provider: "OpsPulse Demo",
              providerReference: `OPS-SEED-REFUND-${index + 1}`,
              reason: isPartiallyRefunded
                ? "Partial demonstration refund."
                : "Full demonstration refund.",
              processedAt: dateDaysAgo(Math.max(0, 1 + ((index * 7) % 28) - 1)),
            },
            update: {
              paymentId,
              status: "SUCCEEDED",
              amount: refundAmount,
              processedAt: dateDaysAgo(Math.max(0, 1 + ((index * 7) % 28) - 1)),
            },
          });
        }
      }
    },
    {
      maxWait: 10_000,
      timeout: 60_000,
    },
  );

  const [productCount, customerCount, orderCount, paymentCount, refundCount] =
    await Promise.all([
      prisma.product.count({ where: { organizationId: ORGANIZATION_ID } }),
      prisma.customer.count({ where: { organizationId: ORGANIZATION_ID } }),
      prisma.order.count({ where: { organizationId: ORGANIZATION_ID } }),
      prisma.payment.count({ where: { organizationId: ORGANIZATION_ID } }),
      prisma.paymentRefund.count({
        where: { organizationId: ORGANIZATION_ID },
      }),
    ]);

  console.log("Development seed completed.");
  console.log(
    JSON.stringify(
      {
        organization: organization.slug,
        products: productCount,
        customers: customerCount,
        orders: orderCount,
        payments: paymentCount,
        refunds: refundCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error("Development seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
