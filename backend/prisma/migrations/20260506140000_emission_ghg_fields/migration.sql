-- GHG module: tag emissions by UI category and entry channel (per Scope 1 / Scope 2 category uploads)
ALTER TABLE "emissions" ADD COLUMN "ghgCategorySlug" TEXT;
ALTER TABLE "emissions" ADD COLUMN "dataEntryChannel" TEXT;

CREATE INDEX "emissions_organizationId_scope_ghgCategorySlug_idx"
  ON "emissions" ("organizationId", "scope", "ghgCategorySlug");
