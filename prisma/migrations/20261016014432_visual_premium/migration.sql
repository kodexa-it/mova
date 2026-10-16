-- CreateEnum
CREATE TYPE "VisualMode" AS ENUM ('STANDARD', 'AI');

-- CreateEnum
CREATE TYPE "ImageGenerationStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'BLOCKED');

-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN     "visualMode" "VisualMode" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "imageMonthlyBudgetMicros" INTEGER NOT NULL DEFAULT 1000000;

-- CreateTable
CREATE TABLE "ImageGeneration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT,
    "slotIndex" INTEGER NOT NULL,
    "layout" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "imageSize" TEXT NOT NULL,
    "status" "ImageGenerationStatus" NOT NULL,
    "estimatedMicros" INTEGER NOT NULL,
    "reservedMicros" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "costSource" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "assetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImageGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageGeneration_assetId_key" ON "ImageGeneration"("assetId");

-- CreateIndex
CREATE INDEX "ImageGeneration_workspaceId_createdAt_idx" ON "ImageGeneration"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageGeneration_itemId_promptHash_idx" ON "ImageGeneration"("itemId", "promptHash");

-- CreateIndex
CREATE UNIQUE INDEX "ImageGeneration_workspaceId_requestKey_key" ON "ImageGeneration"("workspaceId", "requestKey");

-- CreateIndex
CREATE INDEX "ImageAsset_workspaceId_itemId_idx" ON "ImageAsset"("workspaceId", "itemId");

-- AddForeignKey
ALTER TABLE "ImageGeneration" ADD CONSTRAINT "ImageGeneration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageGeneration" ADD CONSTRAINT "ImageGeneration_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageGeneration" ADD CONSTRAINT "ImageGeneration_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ImageAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
