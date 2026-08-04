-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'API_KEY_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'API_KEY_REVOKED';

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "prefix" VARCHAR(12) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hashedKey_key" ON "api_keys"("hashedKey");

-- CreateIndex
CREATE INDEX "api_keys_ownerId_id_idx" ON "api_keys"("ownerId", "id");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
