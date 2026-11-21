import { Prisma } from "../../generated/prisma/client.js";

import { ApiError } from "../../lib/http/api-error.js";
import { prisma } from "../../lib/prisma.js";

import type {
  CreateCustomerInput,
  CustomerContext,
  ListCustomersQuery,
  UpdateCustomerInput,
} from "./customer.types.js";

function handleCustomerDatabaseError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ApiError(
      409,
      "CUSTOMER_CONFLICT",
      "A customer with the same email already exists in this organization.",
    );
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    throw new ApiError(
      409,
      "CUSTOMER_RELATION_CONFLICT",
      "This customer cannot be deleted or changed because related records depend on it.",
    );
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    throw new ApiError(
      404,
      "CUSTOMER_NOT_FOUND",
      "The requested customer was not found.",
    );
  }

  throw error;
}

export async function listCustomers(
  context: CustomerContext,
  query: ListCustomersQuery,
) {
  const { page, limit, search, status, sortBy, sortOrder } = query;

  const skip = (page - 1) * limit;

  const where: Prisma.CustomerWhereInput = {
    organizationId: context.organizationId,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            {
              firstName: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              lastName: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              company: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              phone: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.CustomerOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [customers, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      orderBy: [orderBy, { id: "asc" }],
      skip,
      take: limit,
      include: {
        _count: {
          select: {
            addresses: true,
            orders: true,
          },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    items: customers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getCustomer(
  context: CustomerContext,
  customerId: string,
) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      organizationId: context.organizationId,
    },
    include: {
      _count: {
        select: {
          addresses: true,
          orders: true,
        },
      },
    },
  });

  if (!customer) {
    throw new ApiError(
      404,
      "CUSTOMER_NOT_FOUND",
      "The requested customer was not found.",
    );
  }

  return customer;
}

export async function createCustomer(
  context: CustomerContext,
  input: CreateCustomerInput,
) {
  try {
    return await prisma.customer.create({
      data: {
        organizationId: context.organizationId,
        firstName: input.firstName,
        lastName: input.lastName,
        company: input.company,
        email: input.email,
        phone: input.phone,
        notes: input.notes,
        status: input.status,
      },
      include: {
        _count: {
          select: {
            addresses: true,
            orders: true,
          },
        },
      },
    });
  } catch (error) {
    handleCustomerDatabaseError(error);
  }
}

export async function updateCustomer(
  context: CustomerContext,
  customerId: string,
  input: UpdateCustomerInput,
) {
  const existing = await prisma.customer.findFirst({
    where: {
      id: customerId,
      organizationId: context.organizationId,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw new ApiError(
      404,
      "CUSTOMER_NOT_FOUND",
      "The requested customer was not found.",
    );
  }

  const data: Prisma.CustomerUncheckedUpdateInput = {};

  if (input.firstName !== undefined) {
    data.firstName = input.firstName;
  }

  if (input.lastName !== undefined) {
    data.lastName = input.lastName;
  }

  if (input.company !== undefined) {
    data.company = input.company;
  }

  if (input.email !== undefined) {
    data.email = input.email;
  }

  if (input.phone !== undefined) {
    data.phone = input.phone;
  }

  if (input.notes !== undefined) {
    data.notes = input.notes;
  }

  if (input.status !== undefined) {
    data.status = input.status;
  }

  try {
    return await prisma.customer.update({
      where: {
        id_organizationId: {
          id: customerId,
          organizationId: context.organizationId,
        },
      },
      data,
      include: {
        _count: {
          select: {
            addresses: true,
            orders: true,
          },
        },
      },
    });
  } catch (error) {
    handleCustomerDatabaseError(error);
  }
}

export async function deleteCustomer(
  context: CustomerContext,
  customerId: string,
) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      organizationId: context.organizationId,
    },
    include: {
      _count: {
        select: {
          orders: true,
        },
      },
    },
  });

  if (!customer) {
    throw new ApiError(
      404,
      "CUSTOMER_NOT_FOUND",
      "The requested customer was not found.",
    );
  }

  if (customer._count.orders > 0) {
    throw new ApiError(
      409,
      "CUSTOMER_HAS_ORDER_HISTORY",
      "This customer cannot be deleted because existing orders reference this customer. Archive the customer instead.",
      {
        orderCount: customer._count.orders,
      },
    );
  }

  try {
    await prisma.customer.delete({
      where: {
        id_organizationId: {
          id: customerId,
          organizationId: context.organizationId,
        },
      },
    });

    return {
      id: customer.id,
      deleted: true,
    };
  } catch (error) {
    handleCustomerDatabaseError(error);
  }
}
