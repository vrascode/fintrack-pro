import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { financialTransactionInputSchema } from '@fintrack/shared';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service.js';
import { mapTransaction } from './transactions.service.js';

const revisionSchema = z.object({ revision: z.number().int().positive().max(2147483646) }).strict();
const editSchema = revisionSchema.extend({ transaction: financialTransactionInputSchema });

@Injectable()
export class TransactionChangesService {
  constructor(private readonly prisma: PrismaService) {}

  async edit(userId: string, id: string, body: unknown) {
    const parsed = editSchema.safeParse(body);
    if (!parsed.success || !z.uuid().safeParse(id).success)
      throw new BadRequestException('Invalid transaction update.');
    const { revision, transaction: input } = parsed.data;
    if (input.date > new Date().toISOString().slice(0, 10))
      throw new BadRequestException('Future entries must be scheduled.');
    return this.prisma.db.$transaction(async (db) => {
      const current = await db.transaction.findFirst({ where: { id, userId, voidedAt: null } });
      if (!current) throw new NotFoundException('Transaction not found.');
      if (current.revision !== revision)
        throw new ConflictException('Transaction changed. Reload before editing.');
      const ids = [
        ...new Set(
          [input.accountId, input.transferAccountId].filter((value): value is string => !!value),
        ),
      ];
      const accounts = await db.account.findMany({
        where: { userId, id: { in: ids }, archivedAt: null },
        select: { id: true, openingBalanceOn: true },
      });
      if (
        accounts.length !== ids.length ||
        accounts.some((account) => account.openingBalanceOn.toISOString().slice(0, 10) > input.date)
      ) {
        throw new BadRequestException(
          'Account is unavailable or opens after the transaction date.',
        );
      }
      if (
        input.categoryId &&
        !(await db.category.findFirst({
          where: {
            id: input.categoryId,
            userId,
            archivedAt: null,
            kind: input.kind === 'income' ? 'INCOME' : 'EXPENSE',
          },
          select: { id: true },
        }))
      ) {
        throw new BadRequestException('Category is unavailable.');
      }
      const result = await db.transaction.updateMany({
        where: { id, userId, revision, voidedAt: null },
        data: {
          accountId: input.accountId,
          transferAccountId: input.transferAccountId ?? null,
          categoryId: input.categoryId ?? null,
          kind: input.kind.toUpperCase() as 'INCOME' | 'EXPENSE' | 'TRANSFER',
          amountCents: BigInt(input.amountCents),
          description: input.description,
          occurredOn: new Date(`${input.date}T00:00:00.000Z`),
          revision: { increment: 1 },
        },
      });
      if (!result.count) throw new ConflictException('Transaction changed. Reload before editing.');
      await db.transactionChange.create({
        data: {
          transactionId: id,
          revision,
          operation: 'edit',
          snapshot: { ...mapTransaction(current) },
        },
      });
      return mapTransaction(await db.transaction.findUniqueOrThrow({ where: { id } }));
    });
  }

  async void(userId: string, id: string, body: unknown) {
    const parsed = revisionSchema.safeParse(body);
    if (!parsed.success || !z.uuid().safeParse(id).success)
      throw new BadRequestException('Invalid transaction removal.');
    return this.prisma.db.$transaction(async (db) => {
      const current = await db.transaction.findFirst({ where: { id, userId } });
      if (!current) throw new NotFoundException('Transaction not found.');
      if (current.voidedAt) return { success: true };
      if (current.revision !== parsed.data.revision)
        throw new ConflictException('Transaction changed. Reload before removal.');
      const result = await db.transaction.updateMany({
        where: { id, userId, revision: current.revision, voidedAt: null },
        data: { voidedAt: new Date(), revision: { increment: 1 } },
      });
      if (!result.count) throw new ConflictException('Transaction changed. Reload before removal.');
      await db.transactionChange.create({
        data: {
          transactionId: id,
          revision: current.revision,
          operation: 'void',
          snapshot: { ...mapTransaction(current) },
        },
      });
      return { success: true };
    });
  }
}
