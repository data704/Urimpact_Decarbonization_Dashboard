-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "legalName" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "commercialRegistrationNumber" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "registrationDocumentPath" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "headquarterAddress" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "isGroupCompany" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "groupCompanyName" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "sectorIsicCode" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subSectorIsicCode" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "revenueAmount" DECIMAL(18,2);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "revenueCurrency" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "employeeCount" INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "pocFullName" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "pocDesignation" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "pocDepartment" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "pocEmail" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "pocPhone" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "pocCountryCode" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboardingDraft" JSONB;

-- Existing tenants: treat as onboarded so current deployments keep dashboard access
UPDATE "organizations" SET "onboardingCompletedAt" = COALESCE("onboardingCompletedAt", CURRENT_TIMESTAMP);

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordMustChange" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "login_challenges" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "login_challenges_email_idx" ON "login_challenges"("email");
CREATE INDEX IF NOT EXISTS "login_challenges_userId_idx" ON "login_challenges"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'login_challenges_userId_fkey'
  ) THEN
    ALTER TABLE "login_challenges" ADD CONSTRAINT "login_challenges_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
