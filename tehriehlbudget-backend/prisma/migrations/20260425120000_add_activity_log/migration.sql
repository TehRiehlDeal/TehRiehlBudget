-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('TRANSACTION', 'ACCOUNT', 'ACCOUNT_VALUATION');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "account_id" TEXT,
    "destination_account_id" TEXT,
    "summary" TEXT,
    "snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_account_id_created_at_idx" ON "activity_logs"("user_id", "account_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_destination_account_id_created_at_idx" ON "activity_logs"("user_id", "destination_account_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_entity_type_created_at_idx" ON "activity_logs"("user_id", "entity_type", "created_at");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
