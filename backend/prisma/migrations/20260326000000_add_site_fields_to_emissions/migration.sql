-- AlterTable: Add siteId and siteName columns to emissions table
ALTER TABLE "emissions" ADD COLUMN IF NOT EXISTS "siteId" TEXT;
ALTER TABLE "emissions" ADD COLUMN IF NOT EXISTS "siteName" TEXT;
