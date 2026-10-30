-- Preserve existing categories and classify none as essential by default.
ALTER TABLE "Category"
  ADD COLUMN "essentialForReserve" BOOLEAN NOT NULL DEFAULT FALSE;
