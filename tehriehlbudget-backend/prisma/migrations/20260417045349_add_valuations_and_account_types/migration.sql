-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccountType" ADD VALUE 'CASH';
ALTER TYPE "AccountType" ADD VALUE 'INVESTMENT';
ALTER TYPE "AccountType" ADD VALUE 'RETIREMENT';

-- CreateTable
CREATE TABLE "account_valuations" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_valuations_account_id_date_idx" ON "account_valuations"("account_id", "date");

-- AddForeignKey
ALTER TABLE "account_valuations" ADD CONSTRAINT "account_valuations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
