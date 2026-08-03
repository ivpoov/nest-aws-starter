-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('USER_REGISTERED', 'USER_OAUTH_REGISTERED', 'AUTH_LOGIN', 'AUTH_LOGIN_FAILED', 'AUTH_LOGOUT', 'AUTH_PASSWORD_CHANGED', 'AUTH_METHOD_LINKED', 'AUTH_METHOD_UNLINKED');

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actorId" TEXT,
    "sessionId" TEXT,
    "type" "ActivityType" NOT NULL,
    "meta" JSONB,
    "ip" VARCHAR(45),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_userId_id_idx" ON "activities"("userId", "id");

-- CreateIndex
CREATE INDEX "activities_type_id_idx" ON "activities"("type", "id");
