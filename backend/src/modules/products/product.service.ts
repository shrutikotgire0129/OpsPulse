import { Prisma } from "../../generated/prisma/client.js";

import { ApiError } from "../../lib/http/api-error.js";
import { prisma } from "../../lib/prisma.js";

import type {
  CreateProductInput,
  ListProductsQuery,
  ProductContext,
  UpdateProductInput,
} from "./product.types.js";

function createSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "product";
}

async function generateUniqueSlug(
  organizationId: string,
  name: string,
  excludeProductId?: string,
): Promise<string> {
  const baseSlug = createSlug(name);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.product.findFirst({
      where: {
        organizationId,
        slug: candidate,
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return candidate;

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function assertCategoryExists(
  context: ProductContext,
  categoryId: string,
): Promise<void> {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      organizationId: context.organizationId,
    },
    select: { id: true },
  });

  if (!category) {
    throw new ApiError(
      404,
      "CATEGORY_NOT_FOUND",
      "The selected category was not found in this organization.",
    );
  }
}

async function getOrganizationCurrency(
  organizationId: string,
): Promise<string> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { currencyCode: true },
  });

  if (!organization) {
    throw new ApiError(
      404,
      "ORGANIZATION_NOT_FOUND",
      "The organization associated with this request was not found.",
    );
  }

  return organization.currencyCode;
}

function handleProductDatabaseError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ApiError(
      409,
      "PRODUCT_CONFLICT",
      "A product with the same unique value already exists in this organization.",
    );
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    throw new ApiError(
      409,
      "PRODUCT_RELATION_CONFLICT",
      "This product cannot be changed or deleted because it is referenced by other records.",
    );
  }

  throw error;
}

export async function listProducts(
  context: ProductContext,
  query: ListProductsQuery,
) {
  const { page, limit, search, categoryId, status, sortBy, sortOrder } = query;

  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {
    organizationId: context.organizationId,
    ...(categoryId ? { categoryId } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              sku: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              barcode: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: [orderBy, { id: "asc" }],
      skip,
      take: limit,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: products,
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

export async function getProduct(context: ProductContext, productId: string) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      organizationId: context.organizationId,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
        },
      },
      _count: {
        select: {
          orderItems: true,
        },
      },
    },
  });

  if (!product) {
    throw new ApiError(
      404,
      "PRODUCT_NOT_FOUND",
      "The requested product was not found.",
    );
  }

  return product;
}

export async function createProduct(
  context: ProductContext,
  input: CreateProductInput,
) {
  try {
    if (input.categoryId) {
      await assertCategoryExists(context, input.categoryId);
    }

    const [slug, organizationCurrency] = await Promise.all([
      generateUniqueSlug(context.organizationId, input.name),
      input.currencyCode
        ? Promise.resolve(input.currencyCode)
        : getOrganizationCurrency(context.organizationId),
    ]);

    return await prisma.product.create({
      data: {
        organizationId: context.organizationId,
        name: input.name,
        slug,
        description: input.description,
        sku: input.sku,
        barcode: input.barcode,
        price: new Prisma.Decimal(input.price),
        cost:
          input.cost !== undefined ? new Prisma.Decimal(input.cost) : undefined,
        currencyCode: organizationCurrency,
        status: input.status,
        categoryId: input.categoryId,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  } catch (error) {
    handleProductDatabaseError(error);
  }
}

export async function updateProduct(
  context: ProductContext,
  productId: string,
  input: UpdateProductInput,
) {
  const existing = await prisma.product.findFirst({
    where: {
      id: productId,
      organizationId: context.organizationId,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw new ApiError(
      404,
      "PRODUCT_NOT_FOUND",
      "The requested product was not found.",
    );
  }

  try {
    if (input.categoryId !== undefined && input.categoryId !== null) {
      await assertCategoryExists(context, input.categoryId);
    }

    const data: Prisma.ProductUncheckedUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name;
      data.slug = await generateUniqueSlug(
        context.organizationId,
        input.name,
        productId,
      );
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.sku !== undefined) {
      data.sku = input.sku;
    }

    if (input.barcode !== undefined) {
      data.barcode = input.barcode;
    }

    if (input.price !== undefined) {
      data.price = new Prisma.Decimal(input.price);
    }

    if (input.cost !== undefined) {
      data.cost = input.cost === null ? null : new Prisma.Decimal(input.cost);
    }

    if (input.currencyCode !== undefined) {
      data.currencyCode = input.currencyCode;
    }

    if (input.status !== undefined) {
      data.status = input.status;
    }

    if (input.categoryId !== undefined) {
      data.categoryId = input.categoryId;
    }

    return await prisma.product.update({
      where: {
        id_organizationId: {
          id: productId,
          organizationId: context.organizationId,
        },
      },
      data,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  } catch (error) {
    handleProductDatabaseError(error);
  }
}

export async function deleteProduct(
  context: ProductContext,
  productId: string,
) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      organizationId: context.organizationId,
    },
    include: {
      _count: {
        select: {
          orderItems: true,
        },
      },
    },
  });

  if (!product) {
    throw new ApiError(
      404,
      "PRODUCT_NOT_FOUND",
      "The requested product was not found.",
    );
  }

  if (product._count.orderItems > 0) {
    throw new ApiError(
      409,
      "PRODUCT_HAS_ORDER_HISTORY",
      "This product cannot be deleted because it is referenced by existing order history. Archive it instead.",
      {
        orderItemCount: product._count.orderItems,
      },
    );
  }

  try {
    await prisma.product.delete({
      where: {
        id_organizationId: {
          id: productId,
          organizationId: context.organizationId,
        },
      },
    });

    return {
      id: product.id,
      deleted: true,
    };
  } catch (error) {
    handleProductDatabaseError(error);
  }
}
