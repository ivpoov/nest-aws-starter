-- CreateIndex
CREATE INDEX "activities_type_createdAt_idx" ON "activities"("type", "createdAt");

-- CreateIndex
CREATE INDEX "sessions_activeUntil_idx" ON "sessions"("activeUntil");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");
