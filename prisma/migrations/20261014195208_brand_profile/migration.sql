-- CreateEnum
CREATE TYPE "EmojiPolicy" AS ENUM ('NONE', 'FEW', 'FREE');

-- CreateEnum
CREATE TYPE "BrandRuleKind" AS ENUM ('ALWAYS', 'NEVER');

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "website" TEXT,
    "audienceTimezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandVisual" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "palette" JSONB NOT NULL DEFAULT '[]',
    "headingFont" TEXT NOT NULL DEFAULT '',
    "bodyFont" TEXT NOT NULL DEFAULT '',
    "imageStyle" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandVisual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandVoice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "formality" INTEGER NOT NULL DEFAULT 3,
    "humor" INTEGER NOT NULL DEFAULT 2,
    "technicality" INTEGER NOT NULL DEFAULT 3,
    "enthusiasm" INTEGER NOT NULL DEFAULT 3,
    "wordsToUse" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wordsToAvoid" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emojiPolicy" "EmojiPolicy" NOT NULL DEFAULT 'FEW',
    "examples" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandVoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offering" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceSegment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "painPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "AudienceSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessGoal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "kpi" TEXT NOT NULL DEFAULT '',
    "target" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "BusinessGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPillar" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "weight" INTEGER NOT NULL,

    CONSTRAINT "ContentPillar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "statement" TEXT NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "ProofItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "BrandRuleKind" NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "BrandRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_workspaceId_key" ON "Brand"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandVisual_brandId_key" ON "BrandVisual"("brandId");

-- CreateIndex
CREATE INDEX "BrandVisual_workspaceId_idx" ON "BrandVisual"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandVoice_brandId_key" ON "BrandVoice"("brandId");

-- CreateIndex
CREATE INDEX "BrandVoice_workspaceId_idx" ON "BrandVoice"("workspaceId");

-- CreateIndex
CREATE INDEX "Offering_workspaceId_idx" ON "Offering"("workspaceId");

-- CreateIndex
CREATE INDEX "Offering_brandId_position_idx" ON "Offering"("brandId", "position");

-- CreateIndex
CREATE INDEX "AudienceSegment_workspaceId_idx" ON "AudienceSegment"("workspaceId");

-- CreateIndex
CREATE INDEX "AudienceSegment_brandId_position_idx" ON "AudienceSegment"("brandId", "position");

-- CreateIndex
CREATE INDEX "BusinessGoal_workspaceId_idx" ON "BusinessGoal"("workspaceId");

-- CreateIndex
CREATE INDEX "BusinessGoal_brandId_position_idx" ON "BusinessGoal"("brandId", "position");

-- CreateIndex
CREATE INDEX "ContentPillar_workspaceId_idx" ON "ContentPillar"("workspaceId");

-- CreateIndex
CREATE INDEX "ContentPillar_brandId_position_idx" ON "ContentPillar"("brandId", "position");

-- CreateIndex
CREATE INDEX "ProofItem_workspaceId_idx" ON "ProofItem"("workspaceId");

-- CreateIndex
CREATE INDEX "ProofItem_brandId_position_idx" ON "ProofItem"("brandId", "position");

-- CreateIndex
CREATE INDEX "BrandRule_workspaceId_idx" ON "BrandRule"("workspaceId");

-- CreateIndex
CREATE INDEX "BrandRule_brandId_position_idx" ON "BrandRule"("brandId", "position");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandVisual" ADD CONSTRAINT "BrandVisual_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandVoice" ADD CONSTRAINT "BrandVoice_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceSegment" ADD CONSTRAINT "AudienceSegment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessGoal" ADD CONSTRAINT "BusinessGoal_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPillar" ADD CONSTRAINT "ContentPillar_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofItem" ADD CONSTRAINT "ProofItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRule" ADD CONSTRAINT "BrandRule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
