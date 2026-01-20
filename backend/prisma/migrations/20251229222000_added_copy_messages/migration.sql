-- CreateTable
CREATE TABLE "copy_messages" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copy_messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "copy_messages" ADD CONSTRAINT "copy_messages_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_messages" ADD CONSTRAINT "copy_messages_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "subcategories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
