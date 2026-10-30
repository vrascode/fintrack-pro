-- Add account opening state without changing existing account or ledger data.
ALTER TABLE "Account"
  ADD COLUMN "openingBalanceCents" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "openingBalanceOn" DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN "includeInPlanning" BOOLEAN NOT NULL DEFAULT TRUE;
