import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { billDueOn, billInputSchema, dateInTimeZone, serializeMoney } from '@fintrack/shared';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service.js';

const paymentInput = z
  .object({
    occurrenceIndex: z.number().int().min(0).max(1200),
    amountCents: z.string().regex(/^[1-9]\d*$/),
  })
  .strict();
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

@Injectable()
export class BillsService {
  constructor(private readonly prisma: PrismaService) {}

  private map(
    row: Awaited<ReturnType<PrismaService['db']['bill']['findFirstOrThrow']>> & {
      payments?: {
        id: string;
        occurrenceOn: Date;
        amountCents: bigint;
        transactionId: string;
        createdAt: Date;
      }[];
    },
  ) {
    return {
      id: row.id,
      description: row.description,
      kind: row.kind.toLowerCase(),
      amountCents: serializeMoney(row.amountCents),
      accountId: row.accountId,
      ...(row.categoryId ? { categoryId: row.categoryId } : {}),
      firstDueOn: row.firstDueOn.toISOString().slice(0, 10),
      frequency: row.frequency.toLowerCase(),
      canceledAt: row.canceledAt?.toISOString() ?? null,
      payments: (row.payments ?? []).map((item) => ({
        id: item.id,
        occurrenceOn: item.occurrenceOn.toISOString().slice(0, 10),
        amountCents: serializeMoney(item.amountCents),
        transactionId: item.transactionId,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async list(userId: string) {
    const rows = await this.prisma.db.bill.findMany({
      where: { userId },
      include: { payments: { orderBy: { createdAt: 'desc' } } },
      orderBy: { firstDueOn: 'asc' },
    });
    return rows.map((row) => this.map(row));
  }

  private async validateLinks(userId: string, input: z.infer<typeof billInputSchema>) {
    const account = await this.prisma.db.account.findFirst({
      where: { userId, id: input.accountId, archivedAt: null },
    });
    if (!account) throw new BadRequestException('Account is unavailable.');
    if (input.categoryId) {
      const category = await this.prisma.db.category.findFirst({
        where: {
          userId,
          id: input.categoryId,
          kind: input.kind.toUpperCase() as 'INCOME' | 'EXPENSE',
          archivedAt: null,
        },
      });
      if (!category) throw new BadRequestException('Category is unavailable.');
    }
  }

  async create(userId: string, raw: unknown) {
    const parsed = billInputSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    await this.validateLinks(userId, parsed.data);
    const row = await this.prisma.db.bill.create({
      data: {
        userId,
        description: parsed.data.description,
        kind: parsed.data.kind.toUpperCase() as 'INCOME' | 'EXPENSE',
        amountCents: BigInt(parsed.data.amountCents),
        accountId: parsed.data.accountId,
        categoryId: parsed.data.categoryId ?? null,
        firstDueOn: date(parsed.data.firstDueOn),
        frequency: parsed.data.frequency.toUpperCase() as 'ONCE' | 'WEEKLY' | 'MONTHLY',
      },
    });
    return this.map(row);
  }

  async update(userId: string, id: string, raw: unknown) {
    if (!z.uuid().safeParse(id).success) throw new BadRequestException('Invalid bill ID.');
    const parsed = billInputSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    await this.validateLinks(userId, parsed.data);
    return this.prisma.db.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM "Bill" WHERE id = ${id}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const row = await db.bill.findFirst({ where: { id, userId }, include: { payments: true } });
      if (!row) throw new NotFoundException('Bill not found.');
      if (row.payments.length || row.canceledAt)
        throw new ConflictException('Paid or canceled bills cannot be edited.');
      const updated = await db.bill.update({
        where: { id },
        data: {
          description: parsed.data.description,
          kind: parsed.data.kind.toUpperCase() as 'INCOME' | 'EXPENSE',
          amountCents: BigInt(parsed.data.amountCents),
          accountId: parsed.data.accountId,
          categoryId: parsed.data.categoryId ?? null,
          firstDueOn: date(parsed.data.firstDueOn),
          frequency: parsed.data.frequency.toUpperCase() as 'ONCE' | 'WEEKLY' | 'MONTHLY',
        },
      });
      return this.map(updated);
    });
  }

  async cancel(userId: string, id: string) {
    if (!z.uuid().safeParse(id).success) throw new BadRequestException('Invalid bill ID.');
    return this.prisma.db.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM "Bill" WHERE id = ${id}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const result = await db.bill.updateMany({
        where: { id, userId, canceledAt: null },
        data: { canceledAt: new Date() },
      });
      if (!result.count && !(await db.bill.findFirst({ where: { id, userId } })))
        throw new NotFoundException('Bill not found.');
      return { success: true };
    });
  }

  async pay(userId: string, id: string, key: string | undefined, raw: unknown) {
    if (!z.uuid().safeParse(id).success || !key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new BadRequestException('Valid bill ID and Idempotency-Key required.');
    const parsed = paymentInput.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const amount = BigInt(parsed.data.amountCents);
    const today = dateInTimeZone(new Date());
    return this.prisma.db.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM "Bill" WHERE id = ${id}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const existing = await db.billPayment.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      });
      const bill = await db.bill.findFirst({ where: { id, userId }, include: { payments: true } });
      if (!bill) throw new NotFoundException('Bill not found.');
      const occurrence = billDueOn(
        bill.firstDueOn.toISOString().slice(0, 10),
        bill.frequency.toLowerCase() as 'once' | 'weekly' | 'monthly',
        parsed.data.occurrenceIndex,
      );
      if (existing) {
        if (
          existing.billId !== id ||
          existing.amountCents !== amount ||
          existing.occurrenceOn.toISOString().slice(0, 10) !== occurrence
        )
          throw new ConflictException('Idempotency key reused.');
        return { id: existing.id, transactionId: existing.transactionId };
      }
      if (bill.canceledAt) throw new ConflictException('Bill is canceled.');
      const paid = bill.payments
        .filter((item) => item.occurrenceOn.toISOString().slice(0, 10) === occurrence)
        .reduce((sum, item) => sum + item.amountCents, 0n);
      if (amount > bill.amountCents - paid)
        throw new ConflictException('Payment exceeds remaining amount.');
      const account = await db.account.findFirst({
        where: { id: bill.accountId, userId, archivedAt: null },
      });
      if (!account || account.openingBalanceOn.toISOString().slice(0, 10) > today)
        throw new BadRequestException('Account is unavailable for payment.');
      const transaction = await db.transaction.create({
        data: {
          userId,
          accountId: bill.accountId,
          categoryId: bill.categoryId,
          kind: bill.kind,
          amountCents: amount,
          description: bill.description,
          occurredOn: date(today),
          idempotencyKey: `bill:${key}`,
        },
      });
      const payment = await db.billPayment.create({
        data: {
          userId,
          billId: id,
          occurrenceOn: date(occurrence),
          amountCents: amount,
          idempotencyKey: key,
          transactionId: transaction.id,
        },
      });
      return { id: payment.id, transactionId: transaction.id };
    });
  }
}
