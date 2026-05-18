#!/bin/sh
set -e
echo "Running Prisma migrations..."
npx prisma migrate deploy

# ONE-TIME: wipe old data and seed 4 restricted accounts (REMOVE AFTER FIRST DEPLOY)
# Only runs if the seed accounts don't already exist (safe on container restart)
NEED_SEED=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const u = await p.user.findUnique({ where: { email: 'demo@urimpact.sa' } });
  console.log(u ? 'no' : 'yes');
  await p.\$disconnect();
})();
")
if [ "$NEED_SEED" = "yes" ]; then
  echo "One-time: clearing old data and seeding..."
  node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  (async () => {
    await p.loginChallenge.deleteMany();
    await p.refreshToken.deleteMany();
    await p.auditLog.deleteMany();
    await p.emission.deleteMany();
    await p.document.deleteMany();
    await p.clientConfig.deleteMany();
    await p.user.deleteMany();
    await p.organization.deleteMany();
    console.log('Old data cleared.');
    await p.\$disconnect();
  })();
  "
  node prisma/seed-onetime.cjs
  echo "Seed complete."
else
  echo "Seed accounts already exist, skipping."
fi

echo "Starting server..."
exec node dist/index.js
