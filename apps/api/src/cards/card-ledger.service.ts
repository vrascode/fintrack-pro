import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  addMonths,
  cardPurchaseInputSchema,
  dateInTimeZone,
  installmentAmounts,
  invoiceDueOn,
  invoiceMonthFor,
  serializeMoney,
} from '@fintrack/shared';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service.js';

const paymentSchema = z
  .object({
    invoiceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    accountId: z.uuid(),
    amountCents: z.string().regex(/^[1-9]\d*$/),
  })
  .strict();
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const keyValid = (key: string | undefined) => !!key && /^[A-Za-z0-9._:-]{1,128}$/.test(key);

@Injectable()
export class CardLedgerService {
  constructor(private readonly prisma: PrismaService) {}
  async cancelPurchase(userId: string, cardId: string, purchaseId: string) {
    if (!z.uuid().safeParse(cardId).success || !z.uuid().safeParse(purchaseId).success)
      throw new BadRequestException('Invalid purchase.');
    return this.prisma.db.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM "CreditCard" WHERE id = ${cardId}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const purchase = await db.cardPurchase.findFirst({
        where: { id: purchaseId, cardId, userId },
        include: { installments: true },
      });
      if (!purchase) throw new NotFoundException('Purchase not found.');
      if (purchase.canceledAt) return { success: true };
      const months = purchase.installments.map((item) => item.invoiceMonth);
      if (await db.cardPayment.count({ where: { userId, cardId, invoiceMonth: { in: months } } }))
        throw new ConflictException('Paid invoice requires a refund entry.');
      await db.cardPurchase.update({ where: { id: purchaseId }, data: { canceledAt: new Date() } });
      return { success: true };
    });
  }
  async purchase(userId: string, cardId: string, key: string | undefined, raw: unknown) {
    if (!z.uuid().safeParse(cardId).success || !keyValid(key))
      throw new BadRequestException('Invalid card or idempotency key.');
    const parsed = cardPurchaseInputSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const input = parsed.data;
    if (input.purchasedOn > dateInTimeZone(new Date()))
      throw new BadRequestException('Future purchase date.');
    return this.prisma.db.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM "CreditCard" WHERE id = ${cardId}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const card = await db.creditCard.findFirst({
        where: { id: cardId, userId, archivedAt: null },
      });
      if (!card) throw new NotFoundException('Card not found.');
      const existing = await db.cardPurchase.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key! } },
      });
      if (existing) {
        if (
          existing.cardId !== cardId ||
          existing.description !== input.description ||
          existing.amountCents !== BigInt(input.amountCents) ||
          existing.purchasedOn.toISOString().slice(0, 10) !== input.purchasedOn ||
          existing.installmentCount !== input.installments ||
          existing.categoryId !== (input.categoryId ?? null)
        )
          throw new ConflictException('Idempotency key reused.');
        return { id: existing.id };
      }
      if (
        input.categoryId &&
        !(await db.category.findFirst({
          where: { id: input.categoryId, userId, kind: 'EXPENSE', archivedAt: null },
        }))
      )
        throw new BadRequestException('Category unavailable.');
      const purchases = await db.cardPurchase.findMany({
        where: { userId, cardId, canceledAt: null },
        select: { amountCents: true },
      });
      const paid = await db.cardPayment.aggregate({
        where: { userId, cardId },
        _sum: { amountCents: true },
      });
      const used =
        purchases.reduce((sum, item) => sum + item.amountCents, 0n) - (paid._sum.amountCents ?? 0n);
      if (used + BigInt(input.amountCents) > card.limitCents)
        throw new ConflictException('Card limit exceeded.');
      const firstMonth = invoiceMonthFor(input.purchasedOn, card.closingDay);
      const amounts = installmentAmounts(BigInt(input.amountCents), input.installments);
      const purchase = await db.cardPurchase.create({
        data: {
          userId,
          cardId,
          categoryId: input.categoryId ?? null,
          description: input.description,
          amountCents: BigInt(input.amountCents),
          purchasedOn: day(input.purchasedOn),
          installmentCount: input.installments,
          idempotencyKey: key!,
          installments: {
            create: amounts.map((amount, index) => ({
              number: index + 1,
              amountCents: amount,
              invoiceMonth: day(addMonths(`${firstMonth}-01`, index)),
            })),
          },
        },
      });
      return { id: purchase.id };
    });
  }
  async overview(userId: string, cardId: string) {
    if (!z.uuid().safeParse(cardId).success) throw new BadRequestException('Invalid card.');
    const card = await this.prisma.db.creditCard.findFirst({ where: { id: cardId, userId } });
    if (!card) throw new NotFoundException('Card not found.');
    const purchases = await this.prisma.db.cardPurchase.findMany({
      where: { userId, cardId },
      include: { installments: { orderBy: { number: 'asc' } } },
      orderBy: { purchasedOn: 'desc' },
    });
    const payments = await this.prisma.db.cardPayment.findMany({
      where: { userId, cardId },
      orderBy: { createdAt: 'desc' },
    });
    const invoices = new Map<
      string,
      {
        total: bigint;
        paid: bigint;
        installments: {
          purchaseId: string;
          description: string;
          number: number;
          count: number;
          amountCents: string;
        }[];
      }
    >();
    for (const purchase of purchases)
      if (!purchase.canceledAt)
        for (const item of purchase.installments) {
          const month = item.invoiceMonth.toISOString().slice(0, 7);
          const invoice = invoices.get(month) ?? { total: 0n, paid: 0n, installments: [] };
          invoice.total += item.amountCents;
          invoice.installments.push({
            purchaseId: purchase.id,
            description: purchase.description,
            number: item.number,
            count: purchase.installmentCount,
            amountCents: serializeMoney(item.amountCents),
          });
          invoices.set(month, invoice);
        }
    for (const payment of payments) {
      const month = payment.invoiceMonth.toISOString().slice(0, 7);
      const invoice = invoices.get(month);
      if (invoice) invoice.paid += payment.amountCents;
    }
    const used = [...invoices.values()].reduce((sum, row) => sum + row.total - row.paid, 0n);
    const today = dateInTimeZone(new Date());
    return {
      limitCents: serializeMoney(card.limitCents),
      usedCents: serializeMoney(used),
      availableCents: serializeMoney(card.limitCents - used),
      purchases: purchases.map((row) => ({
        id: row.id,
        description: row.description,
        purchasedOn: row.purchasedOn.toISOString().slice(0, 10),
        amountCents: serializeMoney(row.amountCents),
        canceled: !!row.canceledAt,
      })),
      invoices: [...invoices]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, row]) => {
          const dueOn = invoiceDueOn(month, card.closingDay, card.dueDay);
          return {
            month,
            dueOn,
            totalCents: serializeMoney(row.total),
            paidCents: serializeMoney(row.paid),
            remainingCents: serializeMoney(row.total - row.paid),
            status:
              row.paid >= row.total
                ? 'paid'
                : dueOn < today
                  ? 'overdue'
                  : `${month}-${String(card.closingDay).padStart(2, '0')}` < today
                    ? 'closed'
                    : 'open',
            installments: row.installments,
            payments: payments
              .filter((item) => item.invoiceMonth.toISOString().slice(0, 7) === month)
              .map((item) => ({
                id: item.id,
                amountCents: serializeMoney(item.amountCents),
                transactionId: item.transactionId,
              })),
          };
        }),
    };
  }
  async pay(userId: string, cardId: string, key: string | undefined, raw: unknown) {
    if (!z.uuid().safeParse(cardId).success || !keyValid(key))
      throw new BadRequestException('Invalid card or idempotency key.');
    const parsed = paymentSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const input = parsed.data;
    const amount = BigInt(input.amountCents);
    return this.prisma.db.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM "CreditCard" WHERE id = ${cardId}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const card = await db.creditCard.findFirst({ where: { id: cardId, userId } });
      if (!card) throw new NotFoundException('Card not found.');
      const existing = await db.cardPayment.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key! } },
      });
      if (existing) {
        const originalTransaction = await db.transaction.findUniqueOrThrow({
          where: { id: existing.transactionId },
          select: { accountId: true },
        });
        if (
          existing.cardId !== cardId ||
          existing.amountCents !== amount ||
          existing.invoiceMonth.toISOString().slice(0, 7) !== input.invoiceMonth ||
          originalTransaction.accountId !== input.accountId
        )
          throw new ConflictException('Idempotency key reused.');
        return { id: existing.id, transactionId: existing.transactionId };
      }
      const account = await db.account.findFirst({
        where: { id: input.accountId, userId, archivedAt: null },
      });
      const today = dateInTimeZone(new Date());
      if (!account || account.openingBalanceOn.toISOString().slice(0, 10) > today)
        throw new BadRequestException('Account unavailable.');
      const installments = await db.cardInstallment.findMany({
        where: {
          invoiceMonth: day(`${input.invoiceMonth}-01`),
          purchase: { userId, cardId, canceledAt: null },
        },
        select: { amountCents: true },
      });
      const total = installments.reduce((sum, item) => sum + item.amountCents, 0n);
      const paid = await db.cardPayment.aggregate({
        where: { userId, cardId, invoiceMonth: day(`${input.invoiceMonth}-01`) },
        _sum: { amountCents: true },
      });
      if (amount > total - (paid._sum.amountCents ?? 0n))
        throw new ConflictException('Payment exceeds invoice balance.');
      const transaction = await db.transaction.create({
        data: {
          userId,
          accountId: input.accountId,
          kind: 'EXPENSE',
          amountCents: amount,
          description: `Fatura ${card.name} ${input.invoiceMonth}`,
          occurredOn: day(today),
          idempotencyKey: `card:${key}`,
        },
      });
      const payment = await db.cardPayment.create({
        data: {
          userId,
          cardId,
          invoiceMonth: day(`${input.invoiceMonth}-01`),
          amountCents: amount,
          idempotencyKey: key!,
          transactionId: transaction.id,
        },
      });
      return { id: payment.id, transactionId: transaction.id };
    });
  }
}
