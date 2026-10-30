import { BadRequestException, Injectable } from '@nestjs/common';
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
}): FinancialAccount {
  return {
    id: account.id,
    name: account.name,
    type: accountTypes[account.type],
    openingBalanceCents: serializeMoney(account.openingBalanceCents),
    openingDate: account.openingBalanceOn.toISOString().slice(0, 10),
    includeInPlan: account.includeInPlanning,
  };
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<FinancialAccount[]> {
    const accounts = await this.prisma.db.account.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        openingBalanceCents: true,
        openingBalanceOn: true,
        includeInPlanning: true,
      },
    });
    return accounts.map(mapAccount);
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
