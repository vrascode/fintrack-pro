CREATE TABLE "CardPurchase" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL, "cardId" UUID NOT NULL,
  "categoryId" UUID, "description" VARCHAR(160) NOT NULL, "amountCents" BIGINT NOT NULL,
  "purchasedOn" DATE NOT NULL, "installmentCount" INTEGER NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL, "canceledAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardPurchase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CardPurchase_amount_check" CHECK ("amountCents" > 0),
  CONSTRAINT "CardPurchase_installments_check" CHECK ("installmentCount" BETWEEN 1 AND 48)
);
CREATE UNIQUE INDEX "CardPurchase_userId_idempotencyKey_key" ON "CardPurchase"("userId", "idempotencyKey");
CREATE UNIQUE INDEX "CardPurchase_userId_id_key" ON "CardPurchase"("userId", "id");
CREATE INDEX "CardPurchase_userId_cardId_purchasedOn_idx" ON "CardPurchase"("userId", "cardId", "purchasedOn");
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_userId_cardId_fkey" FOREIGN KEY ("userId", "cardId") REFERENCES "CreditCard"("userId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_userId_categoryId_fkey" FOREIGN KEY ("userId", "categoryId") REFERENCES "Category"("userId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
CREATE TABLE "CardInstallment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "purchaseId" UUID NOT NULL,
  "number" INTEGER NOT NULL, "invoiceMonth" DATE NOT NULL, "amountCents" BIGINT NOT NULL,
  CONSTRAINT "CardInstallment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CardInstallment_amount_check" CHECK ("amountCents" > 0)
);
CREATE UNIQUE INDEX "CardInstallment_purchaseId_number_key" ON "CardInstallment"("purchaseId", "number");
CREATE INDEX "CardInstallment_invoiceMonth_idx" ON "CardInstallment"("invoiceMonth");
ALTER TABLE "CardInstallment" ADD CONSTRAINT "CardInstallment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CardPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "CardPayment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL, "cardId" UUID NOT NULL,
  "invoiceMonth" DATE NOT NULL, "amountCents" BIGINT NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL, "transactionId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CardPayment_amount_check" CHECK ("amountCents" > 0)
);
CREATE UNIQUE INDEX "CardPayment_transactionId_key" ON "CardPayment"("transactionId");
CREATE UNIQUE INDEX "CardPayment_userId_idempotencyKey_key" ON "CardPayment"("userId", "idempotencyKey");
CREATE INDEX "CardPayment_userId_cardId_invoiceMonth_idx" ON "CardPayment"("userId", "cardId", "invoiceMonth");
ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_userId_cardId_fkey" FOREIGN KEY ("userId", "cardId") REFERENCES "CreditCard"("userId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
