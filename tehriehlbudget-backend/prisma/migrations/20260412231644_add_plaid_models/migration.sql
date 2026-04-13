-- CreateTable
CREATE TABLE "plaid_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "institution_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "last_sync" TIMESTAMP(3),
    "sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plaid_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plaid_accounts" (
    "id" TEXT NOT NULL,
    "plaid_item_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "plaid_account_id" TEXT NOT NULL,
    "sync_cursor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plaid_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plaid_items_item_id_key" ON "plaid_items"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "plaid_accounts_account_id_key" ON "plaid_accounts"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "plaid_accounts_plaid_account_id_key" ON "plaid_accounts"("plaid_account_id");

-- AddForeignKey
ALTER TABLE "plaid_items" ADD CONSTRAINT "plaid_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_accounts" ADD CONSTRAINT "plaid_accounts_plaid_item_id_fkey" FOREIGN KEY ("plaid_item_id") REFERENCES "plaid_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_accounts" ADD CONSTRAINT "plaid_accounts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
