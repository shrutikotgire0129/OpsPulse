import { Prisma } from "../../generated/prisma/client.js";

import { ApiError } from "../../lib/http/api-error.js";
import { prisma } from "../../lib/prisma.js";

import type {
  CategoryContext,
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from "./category.types.js";

function createSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "category";
}

async function generateUniqueSlug(
  organizationId: string,
  name: string,
  excludeCategoryId?: string,
): Promise<string> {
  const baseSlug = createSlug(name);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.category.findFirst({
      where: {
        organizationId,
        slug: candidate,
        ...(excludeCategoryId ? { id: { not: excludeCategoryId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return candidate;

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function assertParentExists(
  context: CategoryContext,
  parentId: string,
): Promise<void> {
  const parent = await prisma.category.findFirst({
    where: {
      id: parentId,
      organizationId: context.organizationId,
    },
    select: { id: true },
  });

  if (!parent) {
    throw new ApiError(
      404,
      "PARENT_CATEGORY_NOT_FOUND",
      "The selected parent category was not found.",
    );
  }
}

async function assertNoCategoryCycle(
  context: CategoryContext,
  categoryId: string,
  proposedParentId: string,
): Promise<void> {
  let currentId: string | null = proposedParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === categoryId) {
      throw new ApiError(
        400,
        "CATEGORY_HIERARCHY_CYCLE",
        "A category cannot be moved beneath itself or one of its descendants.",
      );
    }

    if (visited.has(currentId)) {
      throw new ApiError(
        409,
        "INVALID_CATEGORY_HIERARCHY",
        "The existing category hierarchy contains a cycle.",
      );
    }

    visited.add(currentId);

    const current: { id: string; parentId: string | null } | null =
      await prisma.category.findFirst({
        where: {
          id: currentId,
          organizationId: context.organizationId,
        },
        select: {
          id: true,
          parentId: true,
        },
      });

    if (!current) {
      throw new ApiError(
        404,
        "PARENT_CATEGORY_NOT_FOUND",
        "The selected parent category was not found.",
      );
    }

    currentId = current.parentId;
  }
}

function handleCategoryDatabaseError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ApiError(
      409,
      "CATEGORY_CONFLICT",
      "A category with the same unique value already exists.",
    );
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    throw new ApiError(
      409,
      "CATEGORY_RELATION_CONFLICT",
      "This category cannot be changed or deleted because it is referenced by other records.",
    );
  }

  throw error;
}

export async function listCategories(
  context: CategoryContext,
  query: ListCategoriesQuery,
) {
  const { page, limit, search, parentId } = query;
  const skip = (page - 1) * limit;

  const where = {
    organizationId: context.organizationId,
    ...(parentId ? { parentId } : {}),
    ...(search
      ? {
          name: {
            contains: search,
            mode: "insensitive" as const,
          },
        }
      : {}),
  };

  const [categories, total] = await prisma.$transaction([
    prisma.category.findMany({
      where,
      orderBy: [{ name: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
    }),
    prisma.category.count({ where }),
  ]);

  return {
    items: categories,
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

export async function getCategory(
  context: CategoryContext,
  categoryId: string,
) {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      organizationId: context.organizationId,
    },
    include: {
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      children: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: { name: "asc" },
      },
      _count: {
        select: {
          children: true,
          products: true,
        },
      },
    },
  });

  if (!category) {
    throw new ApiError(
      404,
      "CATEGORY_NOT_FOUND",
      "The requested category was not found.",
    );
  }

  return category;
}

export async function createCategory(
  context: CategoryContext,
  input: CreateCategoryInput,
) {
  try {
    if (input.parentId) {
      await assertParentExists(context, input.parentId);
    }

    const slug = await generateUniqueSlug(context.organizationId, input.name);

    return await prisma.category.create({
      data: {
        organizationId: context.organizationId,
        name: input.name,
        slug,
        description: input.description,
        parentId: input.parentId,
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  } catch (error) {
    handleCategoryDatabaseError(error);
  }
}

export async function updateCategory(
  context: CategoryContext,
  categoryId: string,
  input: UpdateCategoryInput,
) {
  const existing = await prisma.category.findFirst({
    where: {
      id: categoryId,
      organizationId: context.organizationId,
    },
    select: {
      id: true,
      parentId: true,
    },
  });

  if (!existing) {
    throw new ApiError(
      404,
      "CATEGORY_NOT_FOUND",
      "The requested category was not found.",
    );
  }

  try {
    if (input.parentId !== undefined && input.parentId !== null) {
      await assertNoCategoryCycle(context, categoryId, input.parentId);
    }

    const data: {
      name?: string;
      slug?: string;
      description?: string | null;
      parentId?: string | null;
    } = {};

    if (input.name !== undefined) {
      data.name = input.name;
      data.slug = await generateUniqueSlug(
        context.organizationId,
        input.name,
        categoryId,
      );
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.parentId !== undefined) {
      data.parentId = input.parentId;
    }

    return await prisma.category.update({
      where: {
        id_organizationId: {
          id: categoryId,
          organizationId: context.organizationId,
        },
      },
      data,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  } catch (error) {
    handleCategoryDatabaseError(error);
  }
}

export async function deleteCategory(
  context: CategoryContext,
  categoryId: string,
) {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      organizationId: context.organizationId,
    },
    include: {
      _count: {
        select: {
          children: true,
          products: true,
        },
      },
    },
  });

  if (!category) {
    throw new ApiError(
      404,
      "CATEGORY_NOT_FOUND",
      "The requested category was not found.",
    );
  }

  if (category._count.children > 0) {
    throw new ApiError(
      409,
      "CATEGORY_HAS_CHILDREN",
      "Move or delete the child categories before deleting this category.",
      { childCount: category._count.children },
    );
  }

  if (category._count.products > 0) {
    throw new ApiError(
      409,
      "CATEGORY_HAS_PRODUCTS",
      "Remove or reassign the products before deleting this category.",
      { productCount: category._count.products },
    );
  }

  try {
    await prisma.category.delete({
      where: {
        id_organizationId: {
          id: categoryId,
          organizationId: context.organizationId,
        },
      },
    });

    return {
      id: category.id,
      deleted: true,
    };
  } catch (error) {
    handleCategoryDatabaseError(error);
  }
}
