CREATE TYPE "BillFrequency" AS ENUM ('ONCE', 'WEEKLY', 'MONTHLY');
CREATE TABLE "Bill" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL,
  "accountId" UUID NOT NULL, "categoryId" UUID, "kind" "CategoryKind" NOT NULL,
  "description" VARCHAR(160) NOT NULL, "amountCents" BIGINT NOT NULL,
  "firstDueOn" DATE NOT NULL, "frequency" "BillFrequency" NOT NULL,
  "canceledAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Bill_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Bill_positive_amount" CHECK ("amountCents" > 0)
);
CREATE UNIQUE INDEX "Bill_userId_id_key" ON "Bill"("userId", "id");
CREATE INDEX "Bill_userId_firstDueOn_idx" ON "Bill"("userId", "firstDueOn");
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_userId_accountId_fkey" FOREIGN KEY ("userId", "accountId") REFERENCES "Account"("userId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_userId_categoryId_fkey" FOREIGN KEY ("userId", "categoryId") REFERENCES "Category"("userId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
CREATE TABLE "BillPayment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL,
  "billId" UUID NOT NULL, "occurrenceOn" DATE NOT NULL,
  "amountCents" BIGINT NOT NULL, "idempotencyKey" VARCHAR(128) NOT NULL,
  "transactionId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillPayment_positive_amount" CHECK ("amountCents" > 0)
);
CREATE UNIQUE INDEX "BillPayment_transactionId_key" ON "BillPayment"("transactionId");
CREATE UNIQUE INDEX "BillPayment_userId_idempotencyKey_key" ON "BillPayment"("userId", "idempotencyKey");
CREATE INDEX "BillPayment_userId_billId_occurrenceOn_idx" ON "BillPayment"("userId", "billId", "occurrenceOn");
ALTER TABLE "BillPayment" ADD CONSTRAINT "BillPayment_userId_billId_fkey" FOREIGN KEY ("userId", "billId") REFERENCES "Bill"("userId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "BillPayment" ADD CONSTRAINT "BillPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
