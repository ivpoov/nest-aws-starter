-- CreateEnum
CREATE TYPE "FileIntent" AS ENUM ('AVATAR', 'ATTACHMENT');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'READY');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'FILE_UPLOADED';

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "intent" "FileIntent" NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_key_key" ON "files"("key");

-- CreateIndex
CREATE INDEX "files_ownerId_id_idx" ON "files"("ownerId", "id");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
