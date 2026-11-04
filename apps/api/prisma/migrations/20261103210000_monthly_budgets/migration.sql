BEGIN;
CREATE TABLE "MonthlyBudget" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "month" DATE NOT NULL,
  "limitCents" BIGINT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonthlyBudget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MonthlyBudget_limit_positive" CHECK ("limitCents" > 0),
  CONSTRAINT "MonthlyBudget_month_first_day" CHECK (EXTRACT(DAY FROM "month") = 1),
  CONSTRAINT "MonthlyBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MonthlyBudget_userId_categoryId_fkey" FOREIGN KEY ("userId", "categoryId") REFERENCES "Category"("userId", "id") ON DELETE NO ACTION ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MonthlyBudget_userId_categoryId_month_key"
  ON "MonthlyBudget"("userId", "categoryId", "month");
CREATE INDEX "MonthlyBudget_userId_month_idx" ON "MonthlyBudget"("userId", "month");
COMMIT;
