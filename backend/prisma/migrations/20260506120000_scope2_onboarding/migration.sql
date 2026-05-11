-- Scope 2 onboarding inventory (facilities, purchased energy baseline)

ALTER TABLE "organizations" ADD COLUMN "scope2Inventory" JSONB;
ALTER TABLE "organizations" ADD COLUMN "scope2OnboardingCompletedAt" TIMESTAMP(3);
