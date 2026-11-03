BEGIN;
ALTER TABLE "Transaction"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "voidedAt" TIMESTAMPTZ(3),
  ADD CONSTRAINT "Transaction_revision_positive" CHECK ("revision" > 0);

CREATE TABLE "TransactionChange" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "transactionId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "operation" VARCHAR(10) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TransactionChange_revision_positive" CHECK ("revision" > 0),
  CONSTRAINT "TransactionChange_operation_valid" CHECK ("operation" IN ('edit', 'void')),
  CONSTRAINT "TransactionChange_transactionId_fkey" FOREIGN KEY ("transactionId")
    REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TransactionChange_transactionId_revision_key"
  ON "TransactionChange"("transactionId", "revision");
COMMIT;
