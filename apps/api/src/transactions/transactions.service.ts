import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  calendarDateSchema,
  financialTransactionInputSchema,
  serializeMoney,
  type FinancialTransaction,
} from '@fintrack/shared';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service.js';

const transactionKinds = { INCOME: 'income', EXPENSE: 'expense', TRANSFER: 'transfer' } as const;
const querySchema = z
  .object({
    kind: z.enum(['income', 'expense', 'transfer']).optional(),
    accountId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(100))
      .optional(),
  })
  .strict()
  .superRefine((query, context) => {
    if (query.from && query.to && query.from > query.to) {
      context.addIssue({ code: 'custom', path: ['to'], message: 'End date precedes start date.' });
    }
  });

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function mapTransaction(transaction: {
  id: string;
  kind: keyof typeof transactionKinds;
  amountCents: bigint;
  occurredOn: Date;
  accountId: string;
  transferAccountId: string | null;
  categoryId: string | null;
  description: string;
}): FinancialTransaction {
  return {
    id: transaction.id,
    kind: transactionKinds[transaction.kind],
    amountCents: serializeMoney(transaction.amountCents),
    date: transaction.occurredOn.toISOString().slice(0, 10),
    status: 'posted',
    accountId: transaction.accountId,
    ...(transaction.transferAccountId ? { transferAccountId: transaction.transferAccountId } : {}),
    ...(transaction.categoryId ? { categoryId: transaction.categoryId } : {}),
    description: transaction.description,
  };
}

function sameRequest(
  existing: Parameters<typeof mapTransaction>[0],
  input: ReturnType<typeof financialTransactionInputSchema.parse>,
): boolean {
  return (
    transactionKinds[existing.kind] === input.kind &&
    existing.amountCents === BigInt(input.amountCents) &&
    existing.occurredOn.toISOString().slice(0, 10) === input.date &&
    existing.accountId === input.accountId &&
    existing.transferAccountId === (input.transferAccountId ?? null) &&
    existing.categoryId === (input.categoryId ?? null) &&
    existing.description === input.description
  );
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: unknown): Promise<FinancialTransaction[]> {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const { from, to, limit, kind, accountId, categoryId } = parsed.data;
    const rows = await this.prisma.db.transaction.findMany({
      where: {
        userId,
        ...(kind ? { kind: kind.toUpperCase() as keyof typeof transactionKinds } : {}),
        ...(accountId ? { OR: [{ accountId }, { transferAccountId: accountId }] } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(from || to
          ? {
              occurredOn: {
                ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
                ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
      take: limit ?? 50,
      select: {
        id: true,
        kind: true,
        amountCents: true,
        occurredOn: true,
        accountId: true,
        transferAccountId: true,
        categoryId: true,
        description: true,
      },
    });
    return rows.map(mapTransaction);
  }

  async create(userId: string, idempotencyKey: string | undefined, rawInput: unknown) {
    const parsed = financialTransactionInputSchema.safeParse(rawInput);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    if (parsed.data.date > new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException('Future-dated transactions must use a scheduled-entry flow.');
    }
    if (
      !idempotencyKey ||
      idempotencyKey.length > 128 ||
      !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)
    ) {
      throw new BadRequestException('A valid Idempotency-Key header is required.');
    }

    const existing = await this.prisma.db.transaction.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      select: {
        id: true,
        kind: true,
        amountCents: true,
        occurredOn: true,
        accountId: true,
        transferAccountId: true,
        categoryId: true,
        description: true,
      },
    });
    if (existing) return this.replay(existing, parsed.data);

    const accountIds = [
      ...new Set([parsed.data.accountId, parsed.data.transferAccountId].filter(Boolean)),
    ] as string[];
    const ownedAccounts = await this.prisma.db.account.findMany({
      where: { userId, id: { in: accountIds }, archivedAt: null },
      select: { id: true },
    });
    if (ownedAccounts.length !== accountIds.length) {
      throw new BadRequestException('Account is unavailable.');
    }
    if (parsed.data.categoryId) {
      const category = await this.prisma.db.category.findFirst({
        where: {
          id: parsed.data.categoryId,
          userId,
          kind: parsed.data.kind === 'income' ? 'INCOME' : 'EXPENSE',
          archivedAt: null,
        },
        select: { id: true },
      });
      if (!category) throw new BadRequestException('Category is unavailable for this transaction.');
    }

    try {
      const created = await this.prisma.db.transaction.create({
        data: {
          userId,
          accountId: parsed.data.accountId,
          transferAccountId: parsed.data.transferAccountId ?? null,
          categoryId: parsed.data.categoryId ?? null,
          kind: parsed.data.kind.toUpperCase() as keyof typeof transactionKinds,
          amountCents: BigInt(parsed.data.amountCents),
          description: parsed.data.description,
          occurredOn: new Date(`${parsed.data.date}T00:00:00.000Z`),
          idempotencyKey,
        },
        select: {
          id: true,
          kind: true,
          amountCents: true,
          occurredOn: true,
          accountId: true,
          transferAccountId: true,
          categoryId: true,
          description: true,
        },
      });
      return mapTransaction(created);
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
      const concurrentReplay = await this.prisma.db.transaction.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
        select: {
          id: true,
          kind: true,
          amountCents: true,
          occurredOn: true,
          accountId: true,
          transferAccountId: true,
          categoryId: true,
          description: true,
        },
      });
      if (concurrentReplay) return this.replay(concurrentReplay, parsed.data);
      throw error;
    }
  }

  private replay(
    existing: Parameters<typeof mapTransaction>[0],
    input: ReturnType<typeof financialTransactionInputSchema.parse>,
  ) {
    if (!sameRequest(existing, input)) {
      throw new ConflictException('Idempotency-Key was already used with different data.');
    }
    return mapTransaction(existing);
  }
}
