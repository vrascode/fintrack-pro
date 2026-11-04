import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { creditCardInputSchema, serializeMoney } from '@fintrack/shared';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}
  private map(row: {
    id: string;
    name: string;
    institution: string;
    lastFour: string | null;
    limitCents: bigint;
    closingDay: number;
    dueDay: number;
    color: string;
    archivedAt: Date | null;
  }) {
    return {
      id: row.id,
      name: row.name,
      institution: row.institution,
      ...(row.lastFour ? { lastFour: row.lastFour } : {}),
      limitCents: serializeMoney(row.limitCents),
      closingDay: row.closingDay,
      dueDay: row.dueDay,
      color: row.color,
      archived: !!row.archivedAt,
    };
  }
  async list(userId: string) {
    return (
      await this.prisma.db.creditCard.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
    ).map((row) => this.map(row));
  }
  async create(userId: string, raw: unknown) {
    const parsed = creditCardInputSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.map(
      await this.prisma.db.creditCard.create({
        data: {
          ...parsed.data,
          userId,
          lastFour: parsed.data.lastFour ?? null,
          limitCents: BigInt(parsed.data.limitCents),
        },
      }),
    );
  }
  async update(userId: string, id: string, raw: unknown) {
    const parsed = creditCardInputSchema
      .partial()
      .extend({ archived: z.boolean().optional() })
      .strict()
      .safeParse(raw);
    if (!z.uuid().safeParse(id).success || !parsed.success || !Object.keys(parsed.data).length)
      throw new BadRequestException('Invalid card update.');
    const { archived, limitCents, name, institution, lastFour, closingDay, dueDay, color } =
      parsed.data;
    const updated = await this.prisma.db.creditCard.updateMany({
      where: { id, userId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(institution !== undefined ? { institution } : {}),
        ...(lastFour !== undefined ? { lastFour } : {}),
        ...(closingDay !== undefined ? { closingDay } : {}),
        ...(dueDay !== undefined ? { dueDay } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(limitCents !== undefined ? { limitCents: BigInt(limitCents) } : {}),
        ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
      },
    });
    if (!updated.count) throw new NotFoundException('Card not found.');
    return this.map(await this.prisma.db.creditCard.findFirstOrThrow({ where: { id, userId } }));
  }
}
