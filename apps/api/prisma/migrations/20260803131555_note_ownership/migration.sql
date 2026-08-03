/*
  Warnings:

  - Added the required column `userId` to the `notes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "notes_userId_id_idx" ON "notes"("userId", "id");

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
