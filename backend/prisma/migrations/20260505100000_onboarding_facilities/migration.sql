-- Persist GHG facility mapping from company onboarding (JSON array)

ALTER TABLE "organizations" ADD COLUMN "onboardingFacilities" JSONB;
