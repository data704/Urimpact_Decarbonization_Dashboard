-- Migrate UserRole from USER/ADMIN/SUPER_ADMIN to new role set.
-- Maps USER -> DATA_CONTRIBUTOR, ADMIN -> ADMINISTRATOR.

CREATE TYPE "UserRole_new" AS ENUM (
  'SUPER_ADMIN',
  'ADMINISTRATOR',
  'DATA_CONTRIBUTOR',
  'ANALYST',
  'VIEWER'
);

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE text USING "role"::text;

UPDATE "users" SET "role" = CASE "role"
  WHEN 'USER' THEN 'DATA_CONTRIBUTOR'
  WHEN 'ADMIN' THEN 'ADMINISTRATOR'
  ELSE "role"
END;

-- Any unknown value becomes VIEWER
UPDATE "users" SET "role" = 'VIEWER'
WHERE "role" NOT IN (
  'SUPER_ADMIN', 'ADMINISTRATOR', 'DATA_CONTRIBUTOR', 'ANALYST', 'VIEWER'
);

ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING "role"::"UserRole_new";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'DATA_CONTRIBUTOR'::"UserRole_new";

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
