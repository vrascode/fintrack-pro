BEGIN;
ALTER TABLE "GoalContribution" ADD COLUMN "idempotencyKey" VARCHAR(128);
UPDATE "GoalContribution" SET "idempotencyKey" = 'legacy-' || "id"::text WHERE "idempotencyKey" IS NULL;
ALTER TABLE "GoalContribution" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "GoalContribution_userId_idempotencyKey_key" ON "GoalContribution"("userId", "idempotencyKey");
COMMIT;
