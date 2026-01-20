/*
  Warnings:

  - A unique constraint covering the columns `[type,chatId]` on the table `channels` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "channels_chatId_key";

-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'telegram';

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "height" INTEGER NOT NULL DEFAULT 1920,
ADD COLUMN     "width" INTEGER NOT NULL DEFAULT 1080;

-- CreateIndex
CREATE UNIQUE INDEX "channels_type_chatId_key" ON "channels"("type", "chatId");
