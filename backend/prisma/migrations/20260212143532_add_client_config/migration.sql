-- CreateTable
CREATE TABLE "client_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetYear" INTEGER NOT NULL,
    "ambitionLevel" TEXT NOT NULL,
    "capexOpexPreference" TEXT,
    "supportingDocuments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_configs_userId_idx" ON "client_configs"("userId");

-- CreateIndex
CREATE INDEX "client_configs_createdAt_idx" ON "client_configs"("createdAt");

-- AddForeignKey
ALTER TABLE "client_configs" ADD CONSTRAINT "client_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
