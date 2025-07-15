/*
  Warnings:

  - You are about to drop the column `chat_history` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `file_search_signature` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `processed_files` on the `sessions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "chat_history",
DROP COLUMN "file_search_signature",
DROP COLUMN "processed_files";

-- CreateTable
CREATE TABLE "user_chat_data" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_history" JSONB,
    "processed_files" JSONB,
    "file_search_signature" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_chat_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_chat_data_user_id_key" ON "user_chat_data"("user_id");

-- AddForeignKey
ALTER TABLE "user_chat_data" ADD CONSTRAINT "user_chat_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
