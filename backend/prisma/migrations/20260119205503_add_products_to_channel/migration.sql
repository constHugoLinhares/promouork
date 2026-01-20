/*
  Warnings:

  - Made the column `categoryId` on table `channels` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `channelId` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "channels" DROP CONSTRAINT "channels_categoryId_fkey";

-- AlterTable
ALTER TABLE "channels" ALTER COLUMN "categoryId" SET NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "channelId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
