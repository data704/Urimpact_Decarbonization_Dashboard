-- Scope 1 asset-discovery onboarding (GHG Protocol Scope 1 boundary)

ALTER TABLE "organizations" ADD COLUMN "scopeOnboardingDraft" JSONB;
ALTER TABLE "organizations" ADD COLUMN "scope1Inventory" JSONB;
ALTER TABLE "organizations" ADD COLUMN "scope1OnboardingCompletedAt" TIMESTAMP(3);
