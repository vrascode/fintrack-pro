import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  goalContributionInputSchema,
  savingsGoalInputSchema,
  savingsGoalUpdateSchema,
  serializeMoney,
  type SavingsGoal,
} from '@fintrack/shared';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<SavingsGoal[]> {
    const rows = await this.prisma.db.savingsGoal.findMany({
      where: { userId },
      include: { contributions: { orderBy: [{ contributedOn: 'desc' }, { createdAt: 'desc' }] } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      targetCents: serializeMoney(row.targetCents),
      targetOn: row.targetOn?.toISOString().slice(0, 10) ?? null,
      status: row.status === 'ACTIVE' ? 'active' : 'closed',
      contributedCents: serializeMoney(
        row.contributions.reduce((sum, contribution) => sum + contribution.amountCents, 0n),
      ),
      contributions: row.contributions.map((contribution) => ({
        id: contribution.id,
        amountCents: serializeMoney(contribution.amountCents),
        contributedOn: contribution.contributedOn.toISOString().slice(0, 10),
        note: contribution.note,
      })),
    }));
  }

  async create(userId: string, rawInput: unknown): Promise<SavingsGoal> {
    const parsed = savingsGoalInputSchema.safeParse(rawInput);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const input = parsed.data;
    const saved = await this.prisma.db.savingsGoal.create({
      data: {
        userId,
        name: input.name,
        targetCents: BigInt(input.targetCents),
        targetOn: input.targetOn ? new Date(`${input.targetOn}T00:00:00.000Z`) : null,
      },
      select: { id: true },
    });
    return this.get(userId, saved.id);
  }

  async update(userId: string, id: string, rawInput: unknown): Promise<SavingsGoal> {
    this.validateId(id);
    const parsed = savingsGoalUpdateSchema.safeParse(rawInput);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const input = parsed.data;
    const result = await this.prisma.db.savingsGoal.updateMany({
      where: { id, userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.targetCents !== undefined ? { targetCents: BigInt(input.targetCents) } : {}),
        ...(input.targetOn !== undefined
          ? { targetOn: input.targetOn ? new Date(`${input.targetOn}T00:00:00.000Z`) : null }
          : {}),
        ...(input.status !== undefined
          ? { status: input.status === 'active' ? ('ACTIVE' as const) : ('CLOSED' as const) }
          : {}),
      },
    });
    if (!result.count) throw new NotFoundException('Goal not found.');
    return this.get(userId, id);
  }

  async contribute(
    userId: string,
    id: string,
    key: string | undefined,
    rawInput: unknown,
  ): Promise<SavingsGoal> {
    this.validateId(id);
    if (!key || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key))
      throw new BadRequestException('A valid idempotency key is required.');
    const parsed = goalContributionInputSchema.safeParse(rawInput);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const input = parsed.data;
    const previous = await this.prisma.db.goalContribution.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
    });
    if (previous) {
      if (
        previous.goalId !== id ||
        previous.amountCents !== BigInt(input.amountCents) ||
        previous.note !== input.note ||
        previous.contributedOn.toISOString().slice(0, 10) !== input.contributedOn
      )
        throw new ConflictException('Idempotency key was used with different goal data.');
      return this.get(userId, id);
    }
    const goal = await this.prisma.db.savingsGoal.findFirst({
      where: { id, userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!goal) throw new NotFoundException('Active goal not found.');
    try {
      await this.prisma.db.goalContribution.create({
        data: {
          userId,
          goalId: id,
          idempotencyKey: key,
          amountCents: BigInt(input.amountCents),
          contributedOn: new Date(`${input.contributedOn}T00:00:00.000Z`),
          note: input.note,
        },
      });
    } catch (error) {
      if (
        typeof error !== 'object' ||
        error === null ||
        !('code' in error) ||
        error.code !== 'P2002'
      )
        throw error;
      const repeated = await this.prisma.db.goalContribution.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      });
      if (
        !repeated ||
        repeated.goalId !== id ||
        repeated.amountCents !== BigInt(input.amountCents) ||
        repeated.note !== input.note ||
        repeated.contributedOn.toISOString().slice(0, 10) !== input.contributedOn
      )
        throw new ConflictException('Idempotency key was used with different goal data.');
    }
    return this.get(userId, id);
  }

  async removeContribution(
    userId: string,
    goalId: string,
    contributionId: string,
  ): Promise<SavingsGoal> {
    this.validateId(goalId);
    this.validateId(contributionId);
    const deleted = await this.prisma.db.goalContribution.deleteMany({
      where: { id: contributionId, goalId, userId },
    });
    if (!deleted.count) throw new NotFoundException('Contribution not found.');
    return this.get(userId, goalId);
  }

  async remove(userId: string, id: string) {
    this.validateId(id);
    const deleted = await this.prisma.db.savingsGoal.deleteMany({ where: { id, userId } });
    if (!deleted.count) throw new NotFoundException('Goal not found.');
    return { success: true } as const;
  }

  private async get(userId: string, id: string): Promise<SavingsGoal> {
    const row = (await this.list(userId)).find((goal) => goal.id === id);
    if (!row) throw new NotFoundException('Goal not found.');
    return row;
  }

  private validateId(id: string) {
    if (!z.uuid().safeParse(id).success) throw new BadRequestException('Invalid goal ID.');
  }
}
