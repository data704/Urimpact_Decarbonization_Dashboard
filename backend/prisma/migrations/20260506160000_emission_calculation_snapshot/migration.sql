-- Persist Climatiq / fallback calculation trace on each emission row
ALTER TABLE "emissions" ADD COLUMN IF NOT EXISTS "calculationSnapshot" JSONB;
