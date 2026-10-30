-- Financial foundation: owner-scoped accounts, categories and ledger entries.
-- Account balances are derived from entries; no separately editable balance is stored.
BEGIN;

CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'WALLET', 'CASH');
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "TransactionKind" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

CREATE TABLE "Account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" "AccountType" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Account_name_nonempty" CHECK (char_length(btrim("name")) BETWEEN 1 AND 80),
    CONSTRAINT "Account_currency_iso_code" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Category" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Category_name_nonempty" CHECK (char_length(btrim("name")) BETWEEN 1 AND 60),
    CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Composite keys must exist before Transaction declares owner-scoped foreign keys.
CREATE UNIQUE INDEX "Account_userId_id_key" ON "Account"("userId", "id");
CREATE UNIQUE INDEX "Category_userId_id_key" ON "Category"("userId", "id");

CREATE TABLE "Transaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "transferAccountId" UUID,
    "categoryId" UUID,
    "kind" "TransactionKind" NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "notes" VARCHAR(1000),
    "occurredOn" DATE NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Transaction_amount_positive" CHECK ("amountCents" > 0),
    CONSTRAINT "Transaction_description_nonempty" CHECK (char_length(btrim("description")) BETWEEN 1 AND 160),
    CONSTRAINT "Transaction_idempotency_key_nonempty" CHECK (char_length(btrim("idempotencyKey")) BETWEEN 1 AND 128),
    CONSTRAINT "Transaction_account_distinct" CHECK ("transferAccountId" IS NULL OR "accountId" <> "transferAccountId"),
    CONSTRAINT "Transaction_kind_shape" CHECK (
        ("kind" = 'TRANSFER' AND "transferAccountId" IS NOT NULL AND "categoryId" IS NULL) OR
        ("kind" IN ('INCOME', 'EXPENSE') AND "transferAccountId" IS NULL)
    ),
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_account_owner_fkey" FOREIGN KEY ("userId", "accountId")
        REFERENCES "Account"("userId", "id") ON DELETE NO ACTION ON UPDATE CASCADE,
    CONSTRAINT "Transaction_transfer_account_owner_fkey" FOREIGN KEY ("userId", "transferAccountId")
        REFERENCES "Account"("userId", "id") ON DELETE NO ACTION ON UPDATE CASCADE,
    CONSTRAINT "Transaction_category_owner_fkey" FOREIGN KEY ("userId", "categoryId")
        REFERENCES "Category"("userId", "id") ON DELETE NO ACTION ON UPDATE CASCADE
);

CREATE INDEX "Account_userId_archivedAt_createdAt_idx" ON "Account"("userId", "archivedAt", "createdAt");
CREATE UNIQUE INDEX "Category_userId_kind_name_key" ON "Category"("userId", "kind", "name");
CREATE INDEX "Category_userId_archivedAt_idx" ON "Category"("userId", "archivedAt");
CREATE UNIQUE INDEX "Transaction_userId_idempotencyKey_key" ON "Transaction"("userId", "idempotencyKey");
CREATE INDEX "Transaction_userId_occurredOn_createdAt_idx" ON "Transaction"("userId", "occurredOn", "createdAt");
CREATE INDEX "Transaction_userId_accountId_occurredOn_idx" ON "Transaction"("userId", "accountId", "occurredOn");
CREATE INDEX "Transaction_userId_categoryId_occurredOn_idx" ON "Transaction"("userId", "categoryId", "occurredOn");

COMMIT;
