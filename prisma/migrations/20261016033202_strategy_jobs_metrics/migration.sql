-- CreateEnum
CREATE TYPE "StrategyStatus" AS ENUM ('NONE', 'PROPOSED', 'APPROVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "MetricSource" AS ENUM ('MANUAL', 'APIFY_PUBLIC');

-- AlterTable
ALTER TABLE "ContentPlan" ADD COLUMN     "strategy" JSONB,
ADD COLUMN     "strategyApprovedAt" TIMESTAMP(3),
ADD COLUMN     "strategyApprovedById" TEXT,
ADD COLUMN     "strategyLlmCallId" TEXT,
ADD COLUMN     "strategyNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "strategyProposedAt" TIMESTAMP(3),
ADD COLUMN     "strategyStatus" "StrategyStatus" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "groupKey" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 2,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "result" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "href" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'INSTAGRAM',
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "permalink" TEXT NOT NULL,
    "shortcode" TEXT NOT NULL,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "source" "MetricSource" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ageHours" INTEGER NOT NULL,
    "likes" INTEGER,
    "comments" INTEGER,
    "plays" INTEGER,
    "saves" INTEGER,
    "shares" INTEGER,
    "reach" INTEGER,
    "profileVisits" INTEGER,
    "inquiries" INTEGER,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "recordedById" TEXT,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_status_runAfter_idx" ON "Job"("status", "runAfter");

-- CreateIndex
CREATE INDEX "Job_workspaceId_groupKey_idx" ON "Job"("workspaceId", "groupKey");

-- CreateIndex
CREATE INDEX "Notification_userId_workspaceId_readAt_idx" ON "Notification"("userId", "workspaceId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_itemId_key" ON "Publication"("itemId");

-- CreateIndex
CREATE INDEX "Publication_workspaceId_publishedAt_idx" ON "Publication"("workspaceId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_workspaceId_shortcode_key" ON "Publication"("workspaceId", "shortcode");

-- CreateIndex
CREATE INDEX "MetricSnapshot_workspaceId_publicationId_capturedAt_idx" ON "MetricSnapshot"("workspaceId", "publicationId", "capturedAt");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
