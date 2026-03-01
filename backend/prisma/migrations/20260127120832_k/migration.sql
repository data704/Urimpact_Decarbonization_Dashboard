-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('UTILITY_BILL', 'FUEL_RECEIPT', 'INVOICE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmissionScope" AS ENUM ('SCOPE_1', 'SCOPE_2', 'SCOPE_3');

-- CreateEnum
CREATE TYPE "EmissionCategory" AS ENUM ('ELECTRICITY', 'NATURAL_GAS', 'FUEL_COMBUSTION', 'TRANSPORTATION', 'WASTE', 'WATER', 'REFRIGERANTS', 'BUSINESS_TRAVEL', 'EMPLOYEE_COMMUTING', 'PURCHASED_GOODS', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "company" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "s3Key" TEXT,
    "documentType" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "ocrData" JSONB,
    "extractedData" JSONB,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "scope" "EmissionScope" NOT NULL,
    "category" "EmissionCategory" NOT NULL,
    "activityType" TEXT NOT NULL,
    "activityAmount" DOUBLE PRECISION NOT NULL,
    "activityUnit" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'AE',
    "co2e" DOUBLE PRECISION NOT NULL,
    "co2" DOUBLE PRECISION,
    "ch4" DOUBLE PRECISION,
    "n2o" DOUBLE PRECISION,
    "emissionFactor" DOUBLE PRECISION NOT NULL,
    "emissionFactorUnit" TEXT NOT NULL,
    "dataSource" TEXT,
    "dataYear" INTEGER,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingPeriodStart" TIMESTAMP(3),
    "billingPeriodEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emission_factors" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "region" TEXT NOT NULL,
    "fuelType" TEXT,
    "unit" TEXT NOT NULL,
    "co2Factor" DOUBLE PRECISION NOT NULL,
    "ch4Factor" DOUBLE PRECISION,
    "n2oFactor" DOUBLE PRECISION,
    "co2eFactor" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "qualityTier" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emission_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_idx" ON "users"("company");

-- CreateIndex
CREATE INDEX "documents_userId_idx" ON "documents"("userId");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_documentType_idx" ON "documents"("documentType");

-- CreateIndex
CREATE INDEX "documents_uploadedAt_idx" ON "documents"("uploadedAt");

-- CreateIndex
CREATE INDEX "emissions_userId_idx" ON "emissions"("userId");

-- CreateIndex
CREATE INDEX "emissions_documentId_idx" ON "emissions"("documentId");

-- CreateIndex
CREATE INDEX "emissions_scope_idx" ON "emissions"("scope");

-- CreateIndex
CREATE INDEX "emissions_category_idx" ON "emissions"("category");

-- CreateIndex
CREATE INDEX "emissions_calculatedAt_idx" ON "emissions"("calculatedAt");

-- CreateIndex
CREATE INDEX "emissions_region_idx" ON "emissions"("region");

-- CreateIndex
CREATE UNIQUE INDEX "emission_factors_activityId_key" ON "emission_factors"("activityId");

-- CreateIndex
CREATE INDEX "emission_factors_activityId_idx" ON "emission_factors"("activityId");

-- CreateIndex
CREATE INDEX "emission_factors_category_idx" ON "emission_factors"("category");

-- CreateIndex
CREATE INDEX "emission_factors_region_idx" ON "emission_factors"("region");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emissions" ADD CONSTRAINT "emissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emissions" ADD CONSTRAINT "emissions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
