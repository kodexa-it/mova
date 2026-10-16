-- AlterTable
ALTER TABLE "ImageAsset" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'GENERATED',
ADD COLUMN     "uploadedById" TEXT;

-- CreateTable
CREATE TABLE "BrandReference" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandReference_workspaceId_createdAt_idx" ON "BrandReference"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "BrandReference" ADD CONSTRAINT "BrandReference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
