// One-time seed script — plain Node.js, no tsx needed
const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('Starting database seed...');

  const accounts = [
    {
      email: 'demo@urimpact.sa',
      password: 'Demo@2026',
      firstName: 'Demo',
      lastName: 'User',
      company: 'URIMPACT Demo',
    },
    {
      email: 'komal@urimpact.sa',
      password: 'Komal@121102',
      firstName: 'Komal',
      lastName: 'Kaushik',
      company: 'URIMPACT',
    },
    {
      email: 'b.aldelewy@urimpact.sa',
      password: 'Admin@123',
      firstName: 'B',
      lastName: 'Aldelewy',
      company: 'URIMPACT',
    },
    {
      email: 'data@urimpact.sa',
      password: 'Admin@1234',
      firstName: 'Data',
      lastName: 'User',
      company: 'URIMPACT',
    },
  ];

  for (const acct of accounts) {
    const hashedPassword = await hashPassword(acct.password);

    const org = await prisma.organization.create({
      data: { name: acct.company },
    });

    const user = await prisma.user.upsert({
      where: { email: acct.email },
      update: {},
      create: {
        email: acct.email,
        password: hashedPassword,
        firstName: acct.firstName,
        lastName: acct.lastName,
        company: acct.company,
        organizationId: org.id,
        role: UserRole.ADMINISTRATOR,
        isActive: true,
        emailVerified: true,
      },
    });
    console.log('User created: ' + user.email + ' (org: ' + org.name + ')');
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
