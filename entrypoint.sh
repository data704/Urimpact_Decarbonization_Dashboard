#!/bin/sh
set -e
echo "Running Prisma migrations..."
npx prisma migrate deploy

# ONE-TIME: wipe old data and seed 4 restricted accounts (REMOVE AFTER FIRST DEPLOY)
echo "One-time: resetting and seeding database..."
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
npx tsx prisma/seed.ts
echo "Seed complete."

echo "Starting server..."
exec node dist/index.js
