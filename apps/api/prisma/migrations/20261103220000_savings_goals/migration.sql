BEGIN;
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TABLE "SavingsGoal" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "targetCents" BIGINT NOT NULL,
  "targetOn" DATE,
  "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavingsGoal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SavingsGoal_target_positive" CHECK ("targetCents" > 0),
  CONSTRAINT "SavingsGoal_name_nonblank" CHECK (length(trim("name")) > 0),
  CONSTRAINT "SavingsGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SavingsGoal_userId_id_key" ON "SavingsGoal"("userId", "id");
CREATE INDEX "SavingsGoal_userId_status_createdAt_idx" ON "SavingsGoal"("userId", "status", "createdAt");
CREATE TABLE "GoalContribution" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "goalId" UUID NOT NULL,
  "amountCents" BIGINT NOT NULL,
  "note" VARCHAR(160),
  "contributedOn" DATE NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoalContribution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GoalContribution_amount_positive" CHECK ("amountCents" > 0),
  CONSTRAINT "GoalContribution_userId_goalId_fkey" FOREIGN KEY ("userId", "goalId") REFERENCES "SavingsGoal"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "GoalContribution_userId_goalId_contributedOn_idx" ON "GoalContribution"("userId", "goalId", "contributedOn");
COMMIT;
