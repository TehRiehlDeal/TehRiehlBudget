-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "destination_account_id" TEXT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
