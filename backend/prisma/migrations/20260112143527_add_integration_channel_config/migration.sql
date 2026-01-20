-- CreateTable
CREATE TABLE "integration_channel_configs" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_channel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_channel_configs_integrationId_channelId_key" ON "integration_channel_configs"("integrationId", "channelId");

-- AddForeignKey
ALTER TABLE "integration_channel_configs" ADD CONSTRAINT "integration_channel_configs_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_channel_configs" ADD CONSTRAINT "integration_channel_configs_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
