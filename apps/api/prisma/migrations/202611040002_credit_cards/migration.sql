CREATE TABLE "CreditCard" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL, "institution" VARCHAR(80) NOT NULL,
  "lastFour" CHAR(4), "limitCents" BIGINT NOT NULL,
  "closingDay" INTEGER NOT NULL, "dueDay" INTEGER NOT NULL,
  "color" CHAR(7) NOT NULL, "archivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CreditCard_limit_check" CHECK ("limitCents" > 0),
  CONSTRAINT "CreditCard_closing_check" CHECK ("closingDay" BETWEEN 1 AND 28),
  CONSTRAINT "CreditCard_due_check" CHECK ("dueDay" BETWEEN 1 AND 28),
  CONSTRAINT "CreditCard_last_four_check" CHECK ("lastFour" IS NULL OR "lastFour" ~ '^[0-9]{4}$')
);
CREATE UNIQUE INDEX "CreditCard_userId_id_key" ON "CreditCard"("userId", "id");
CREATE INDEX "CreditCard_userId_archivedAt_idx" ON "CreditCard"("userId", "archivedAt");
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
