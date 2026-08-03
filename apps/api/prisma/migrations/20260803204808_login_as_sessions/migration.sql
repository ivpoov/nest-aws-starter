-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'ADMIN_LOGIN_AS';

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "signedAsAdminId" TEXT;

-- CreateIndex
CREATE INDEX "sessions_signedAsAdminId_idx" ON "sessions"("signedAsAdminId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_signedAsAdminId_fkey" FOREIGN KEY ("signedAsAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
