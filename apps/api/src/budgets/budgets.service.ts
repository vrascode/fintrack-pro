import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  addMonths,
  budgetMonthSchema,
  monthlyBudgetInputSchema,
  serializeMoney,
  type MonthlyBudget,
} from '@fintrack/shared';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service.js';

const querySchema = z.object({ month: budgetMonthSchema }).strict();
const updateSchema = monthlyBudgetInputSchema.pick({ limitCents: true });

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, rawQuery: unknown): Promise<MonthlyBudget[]> {
    const query = querySchema.safeParse(rawQuery);
    if (!query.success) throw new BadRequestException(query.error.issues);
    const month = query.data.month;
    const rows = await this.prisma.db.monthlyBudget.findMany({
      where: { userId, month: new Date(`${month}-01T00:00:00.000Z`) },
      orderBy: [{ category: { name: 'asc' } }, { id: 'asc' }],
      include: { category: { select: { name: true } } },
    });
    if (!rows.length) return [];
    const grouped = await this.prisma.db.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        categoryId: { in: rows.map((row) => row.categoryId) },
        kind: 'EXPENSE',
        voidedAt: null,
        occurredOn: {
          gte: new Date(`${month}-01T00:00:00.000Z`),
          lt: new Date(`${addMonths(`${month}-01`, 1).slice(0, 7)}-01T00:00:00.000Z`),
        },
      },
      _sum: { amountCents: true },
    });
    const spent = new Map(grouped.map((row) => [row.categoryId, row._sum.amountCents ?? 0n]));
    return rows.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      month,
      limitCents: serializeMoney(row.limitCents),
      spentCents: serializeMoney(spent.get(row.categoryId) ?? 0n),
    }));
  }

  async create(userId: string, rawInput: unknown): Promise<MonthlyBudget> {
    const parsed = monthlyBudgetInputSchema.safeParse(rawInput);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const input = parsed.data;
    const category = await this.prisma.db.category.findFirst({
      where: { id: input.categoryId, userId, kind: 'EXPENSE', archivedAt: null },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('An active expense category is required.');
    try {
      const saved = await this.prisma.db.monthlyBudget.create({
        data: {
          userId,
          categoryId: input.categoryId,
          month: new Date(`${input.month}-01T00:00:00.000Z`),
          limitCents: BigInt(input.limitCents),
        },
        select: { id: true },
      });
      return (await this.list(userId, { month: input.month })).find((row) => row.id === saved.id)!;
    } catch (error) {
      if (this.isUnique(error))
        throw new ConflictException('A budget already exists for this category and month.');
      throw error;
    }
  }

  async update(userId: string, id: string, rawInput: unknown): Promise<MonthlyBudget> {
    const parsed = updateSchema.safeParse(rawInput);
    if (!z.uuid().safeParse(id).success || !parsed.success)
      throw new BadRequestException('Invalid budget update.');
    const row = await this.prisma.db.monthlyBudget.findFirst({
      where: { id, userId },
      select: { month: true },
    });
    if (!row) throw new NotFoundException('Budget not found.');
    await this.prisma.db.monthlyBudget.updateMany({
      where: { id, userId },
      data: { limitCents: BigInt(parsed.data.limitCents) },
    });
    const month = row.month.toISOString().slice(0, 7);
    const updated = (await this.list(userId, { month })).find((item) => item.id === id);
    if (!updated) throw new NotFoundException('Budget not found.');
    return updated;
  }

  async remove(userId: string, id: string) {
    if (!z.uuid().safeParse(id).success) throw new BadRequestException('Invalid budget ID.');
    const result = await this.prisma.db.monthlyBudget.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException('Budget not found.');
    return { success: true } as const;
  }

  private isUnique(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
