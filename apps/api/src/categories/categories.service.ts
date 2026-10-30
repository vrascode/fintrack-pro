import { BadRequestException, Injectable } from '@nestjs/common';
import { financialCategoryInputSchema, type FinancialCategory } from '@fintrack/shared';
import { PrismaService } from '../database/prisma.service.js';

const categoryKinds = { INCOME: 'income', EXPENSE: 'expense' } as const;

function mapCategory(category: {
  id: string;
  name: string;
  kind: keyof typeof categoryKinds;
  essentialForReserve: boolean;
}): FinancialCategory {
  return {
    id: category.id,
    name: category.name,
    kind: categoryKinds[category.kind],
    essentialForReserve: category.essentialForReserve,
  };
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<FinancialCategory[]> {
    const categories = await this.prisma.db.category.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, kind: true, essentialForReserve: true },
    });
    return categories.map(mapCategory);
  }

  async create(userId: string, input: unknown): Promise<FinancialCategory> {
    const parsed = financialCategoryInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    try {
      const category = await this.prisma.db.category.create({
        data: {
          userId,
          name: parsed.data.name,
          kind: parsed.data.kind.toUpperCase() as keyof typeof categoryKinds,
          essentialForReserve: parsed.data.essentialForReserve,
        },
        select: { id: true, name: true, kind: true, essentialForReserve: true },
      });
      return mapCategory(category);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('This category already exists for this type.');
      }
      throw error;
    }
  }
}
