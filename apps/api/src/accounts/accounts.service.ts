import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import {
  financialAccountInputSchema,
  serializeMoney,
  type FinancialAccount,
} from '@fintrack/shared';
import { PrismaService } from '../database/prisma.service.js';

const accountTypes = {
  CHECKING: 'checking',
  SAVINGS: 'savings',
  WALLET: 'wallet',
  CASH: 'cash',
} as const;

function mapAccount(account: {
  id: string;
  name: string;
  type: keyof typeof accountTypes;
  openingBalanceCents: bigint;
  openingBalanceOn: Date;
  includeInPlanning: boolean;
  archivedAt?: Date | null;
}): FinancialAccount {
  return {
    id: account.id,
    name: account.name,
    type: accountTypes[account.type],
    openingBalanceCents: serializeMoney(account.openingBalanceCents),
    openingDate: account.openingBalanceOn.toISOString().slice(0, 10),
    includeInPlan: account.includeInPlanning,
    ...(account.archivedAt ? { archived: true } : {}),
  };
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<FinancialAccount[]> {
    const accounts = await this.prisma.db.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        openingBalanceCents: true,
        openingBalanceOn: true,
        includeInPlanning: true,
        archivedAt: true,
      },
    });
    return accounts.map(mapAccount);
  }

  async update(userId: string, id: string, input: unknown) {
    const parsed = financialAccountInputSchema
      .pick({ name: true, type: true, includeInPlan: true })
      .partial()
      .extend({ archived: z.boolean().optional() })
      .strict()
      .safeParse(input);
    if (!z.uuid().safeParse(id).success || !parsed.success || !Object.keys(parsed.data).length)
      throw new BadRequestException('Invalid account update.');
    const { name, type, includeInPlan, archived } = parsed.data;
    const result = await this.prisma.db.account.updateMany({
      where: { id, userId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(type ? { type: type.toUpperCase() as keyof typeof accountTypes } : {}),
        ...(includeInPlan !== undefined ? { includeInPlanning: includeInPlan } : {}),
        ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
      },
    });
    if (!result.count) throw new NotFoundException('Account not found.');
    return { success: true };
  }

  async create(userId: string, input: unknown): Promise<FinancialAccount> {
    const parsed = financialAccountInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const account = await this.prisma.db.account.create({
      data: {
        userId,
        name: parsed.data.name,
        type: parsed.data.type.toUpperCase() as keyof typeof accountTypes,
        currency: 'BRL',
        openingBalanceCents: BigInt(parsed.data.openingBalanceCents),
        openingBalanceOn: new Date(`${parsed.data.openingDate}T00:00:00.000Z`),
        includeInPlanning: parsed.data.includeInPlan,
      },
      select: {
        id: true,
        name: true,
        type: true,
        openingBalanceCents: true,
        openingBalanceOn: true,
        includeInPlanning: true,
      },
    });
    return mapAccount(account);
  }
}
