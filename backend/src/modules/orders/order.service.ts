import { randomUUID } from "node:crypto";

import { Prisma } from "../../generated/prisma/client.js";

import { ApiError } from "../../lib/http/api-error.js";
import { prisma } from "../../lib/prisma.js";

import type {
  CreateOrderInput,
  ListOrdersQuery,
  OrderContext,
} from "./order.types.js";

const MAX_DECIMAL_AMOUNT = new Prisma.Decimal("1000000000000000");

function handleOrderDatabaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError(
        409,
        "ORDER_CONFLICT",
        "An order with conflicting unique data already exists.",
      );
    }

    if (error.code === "P2003") {
      throw new ApiError(
        409,
        "ORDER_RELATION_CONFLICT",
        "The order conflicts with an existing database relationship.",
      );
    }

    if (error.code === "P2025") {
      throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
    }
  }

  throw error;
}

/**
 * All persisted financial values must fit Decimal(19,4).
 *
 * Reject rather than silently round values that cannot be
 * represented exactly at the database's four-decimal scale.
 */
function assertMoneyPrecision(value: Prisma.Decimal, fieldName: string): void {
  if (
    value.isNegative() ||
    value.greaterThanOrEqualTo(MAX_DECIMAL_AMOUNT) ||
    value.decimalPlaces() > 4
  ) {
    throw new ApiError(
      422,
      "INVALID_ORDER_AMOUNT",
      `${fieldName} must be non-negative and fit within 15 integer digits and 4 decimal places.`,
    );
  }
}

function createOrderNumber(): string {
  return `ORD-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

const orderDetailsInclude = {
  customer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      email: true,
      phone: true,
    },
  },
  items: {
    orderBy: {
      lineNumber: "asc",
    },
  },
} satisfies Prisma.OrderInclude;

/**
 * List orders belonging to the authenticated organization.
 */
export async function listOrders(
  context: OrderContext,
  query: ListOrdersQuery,
) {
  const where: Prisma.OrderWhereInput = {
    organizationId: context.organizationId,
  };

  if (query.status) {
    where.status = query.status;
  }

  if (query.customerId) {
    where.customerId = query.customerId;
  }

  if (query.search) {
    where.OR = [
      {
        orderNumber: {
          contains: query.search,
          mode: "insensitive",
        },
      },
      {
        customer: {
          is: {
            firstName: {
              contains: query.search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        customer: {
          is: {
            lastName: {
              contains: query.search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        customer: {
          is: {
            email: {
              contains: query.search,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  const orderBy = {
    [query.sortBy]: query.sortOrder,
  } as Prisma.OrderOrderByWithRelationInput;

  const skip = (query.page - 1) * query.limit;

  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: [orderBy, { id: "asc" }],
      skip,
      take: query.limit,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            email: true,
          },
        },
        _count: {
          select: {
            items: true,
            payments: true,
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items: orders,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasNextPage: skip + orders.length < total,
      hasPreviousPage: query.page > 1,
    },
  };
}

/**
 * Retrieve one order without allowing cross-organization access.
 */
export async function getOrder(context: OrderContext, orderId: string) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      organizationId: context.organizationId,
    },
    include: orderDetailsInclude,
  });

  if (!order) {
    throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
  }

  return order;
}

/**
 * Create an order using trusted database product/customer data.
 *
 * The client supplies product IDs, quantities, line discounts,
 * manual tax amounts, and shipping. It never supplies product
 * names, SKUs, unit prices, currency codes, or calculated totals.
 */
export async function createOrder(
  context: OrderContext,
  input: CreateOrderInput,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({
        where: {
          id: context.organizationId,
        },
        select: {
          id: true,
          currencyCode: true,
        },
      });

      if (!organization) {
        throw new ApiError(
          404,
          "ORGANIZATION_NOT_FOUND",
          "Organization not found.",
        );
      }

      if (input.customerId) {
        const customer = await tx.customer.findFirst({
          where: {
            id: input.customerId,
            organizationId: context.organizationId,
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (!customer) {
          throw new ApiError(
            404,
            "CUSTOMER_NOT_FOUND",
            "Customer not found in this organization.",
          );
        }

        if (customer.status !== "ACTIVE") {
          throw new ApiError(
            409,
            "CUSTOMER_INACTIVE",
            "Orders cannot be created for an archived customer.",
          );
        }
      }

      const productIds = input.items.map((item) => item.productId);

      const products = await tx.product.findMany({
        where: {
          id: {
            in: productIds,
          },
          organizationId: context.organizationId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          currencyCode: true,
        },
      });

      const productMap = new Map(
        products.map((product) => [product.id, product]),
      );

      for (const item of input.items) {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new ApiError(
            404,
            "ORDER_PRODUCT_NOT_FOUND",
            `Product ${item.productId} was not found or is not active in this organization.`,
          );
        }

        if (product.currencyCode !== organization.currencyCode) {
          throw new ApiError(
            409,
            "PRODUCT_CURRENCY_MISMATCH",
            `Product ${product.name} does not use the organization's currency.`,
          );
        }
      }

      let subtotal = new Prisma.Decimal(0);
      let discountTotal = new Prisma.Decimal(0);
      let taxTotal = new Prisma.Decimal(0);

      const orderItems = input.items.map((item, index) => {
        const product = productMap.get(item.productId)!;

        const quantity = new Prisma.Decimal(item.quantity);
        const unitPrice = new Prisma.Decimal(product.price.toString());
        const discountAmount = new Prisma.Decimal(item.discountAmount);
        const taxAmount = new Prisma.Decimal(item.taxAmount);

        const grossLine = quantity.mul(unitPrice);

        assertMoneyPrecision(grossLine, "Line gross amount");

        if (discountAmount.greaterThan(grossLine)) {
          throw new ApiError(
            422,
            "DISCOUNT_EXCEEDS_LINE_AMOUNT",
            `Discount for product ${product.name} cannot exceed its gross line amount.`,
          );
        }

        const lineTotal = grossLine.minus(discountAmount).plus(taxAmount);

        assertMoneyPrecision(discountAmount, "Line discount");
        assertMoneyPrecision(taxAmount, "Line tax");
        assertMoneyPrecision(lineTotal, "Line total");

        subtotal = subtotal.plus(grossLine);
        discountTotal = discountTotal.plus(discountAmount);
        taxTotal = taxTotal.plus(taxAmount);

        return {
          lineNumber: index + 1,
          productName: product.name,
          sku: product.sku,
          quantity,
          unitPrice,
          discountAmount,
          taxAmount,
          lineTotal,
          product: {
            connect: {
              id_organizationId: {
                id: product.id,
                organizationId: context.organizationId,
              },
            },
          },
        };
      });

      const shippingTotal = new Prisma.Decimal(input.shippingTotal);

      assertMoneyPrecision(subtotal, "Order subtotal");
      assertMoneyPrecision(discountTotal, "Order discount total");
      assertMoneyPrecision(taxTotal, "Order tax total");
      assertMoneyPrecision(shippingTotal, "Shipping total");

      const grandTotal = subtotal
        .minus(discountTotal)
        .plus(taxTotal)
        .plus(shippingTotal);

      assertMoneyPrecision(grandTotal, "Order grand total");

      return tx.order.create({
        data: {
          orderNumber: createOrderNumber(),
          currencyCode: organization.currencyCode,
          subtotal,
          discountTotal,
          taxTotal,
          shippingTotal,
          grandTotal,

          organization: {
            connect: {
              id: context.organizationId,
            },
          },

          ...(input.customerId
            ? {
                customer: {
                  connect: {
                    id_organizationId: {
                      id: input.customerId,
                      organizationId: context.organizationId,
                    },
                  },
                },
              }
            : {}),

          ...(input.billingAddress
            ? {
                billingAddress: input.billingAddress as Prisma.InputJsonValue,
              }
            : {}),

          ...(input.shippingAddress
            ? {
                shippingAddress: input.shippingAddress as Prisma.InputJsonValue,
              }
            : {}),

          ...(input.channel !== undefined ? { channel: input.channel } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),

          items: {
            create: orderItems,
          },
        },
        include: orderDetailsInclude,
      });
    });
  } catch (error) {
    handleOrderDatabaseError(error);
  }
}
