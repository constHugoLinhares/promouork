-- CreateTable
CREATE TABLE "post_schedulers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "integrationId" TEXT NOT NULL,

    CONSTRAINT "post_schedulers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_scheduler_channels" (
    "id" TEXT NOT NULL,
    "schedulerId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_scheduler_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "post_scheduler_channels_schedulerId_channelId_key" ON "post_scheduler_channels"("schedulerId", "channelId");

-- AddForeignKey
ALTER TABLE "post_schedulers" ADD CONSTRAINT "post_schedulers_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_scheduler_channels" ADD CONSTRAINT "post_scheduler_channels_schedulerId_fkey" FOREIGN KEY ("schedulerId") REFERENCES "post_schedulers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_scheduler_channels" ADD CONSTRAINT "post_scheduler_channels_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
