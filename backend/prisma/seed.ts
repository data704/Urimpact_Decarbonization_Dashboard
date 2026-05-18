import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
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

    // Create organization for this user
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
    console.log(`User created: ${user.email} (org: ${org.name})`);
  }

  // Keep emission factors for the platform
  const emissionFactors = [
    {
      activityId: 'electricity-grid-ae-du',
      category: 'electricity',
      subcategory: 'grid',
      region: 'AE-DU',
      unit: 'kWh',
      co2Factor: 0.38,
      ch4Factor: 0.00001,
      n2oFactor: 0.000001,
      co2eFactor: 0.4,
      source: 'DEWA',
      year: 2024,
      qualityTier: 1,
    },
    {
      activityId: 'electricity-grid-ae-az',
      category: 'electricity',
      subcategory: 'grid',
      region: 'AE-AZ',
      unit: 'kWh',
      co2Factor: 0.42,
      ch4Factor: 0.00001,
      n2oFactor: 0.000001,
      co2eFactor: 0.44,
      source: 'ADWEA',
      year: 2024,
      qualityTier: 1,
    },
    {
      activityId: 'electricity-grid-ae',
      category: 'electricity',
      subcategory: 'grid',
      region: 'AE',
      unit: 'kWh',
      co2Factor: 0.4,
      ch4Factor: 0.00001,
      n2oFactor: 0.000001,
      co2eFactor: 0.42,
      source: 'IEA',
      year: 2024,
      qualityTier: 2,
    },
    {
      activityId: 'diesel-stationary',
      category: 'fuel',
      subcategory: 'diesel',
      region: 'GLOBAL',
      unit: 'L',
      co2Factor: 2.68,
      ch4Factor: 0.0001,
      n2oFactor: 0.0001,
      co2eFactor: 2.7,
      source: 'DEFRA',
      year: 2024,
      qualityTier: 1,
    },
    {
      activityId: 'petrol-stationary',
      category: 'fuel',
      subcategory: 'petrol',
      region: 'GLOBAL',
      unit: 'L',
      co2Factor: 2.31,
      ch4Factor: 0.0001,
      n2oFactor: 0.0001,
      co2eFactor: 2.35,
      source: 'DEFRA',
      year: 2024,
      qualityTier: 1,
    },
    {
      activityId: 'natural-gas-stationary',
      category: 'fuel',
      subcategory: 'natural_gas',
      region: 'GLOBAL',
      unit: 'm3',
      co2Factor: 2.02,
      ch4Factor: 0.00004,
      n2oFactor: 0.000001,
      co2eFactor: 2.04,
      source: 'IPCC',
      year: 2024,
      qualityTier: 1,
    },
    {
      activityId: 'water-supply-ae',
      category: 'water',
      subcategory: 'supply',
      region: 'AE',
      unit: 'm3',
      co2Factor: 0.344,
      ch4Factor: 0,
      n2oFactor: 0,
      co2eFactor: 0.344,
      source: 'DEFRA',
      year: 2024,
      qualityTier: 2,
    },
  ];

  for (const factor of emissionFactors) {
    await prisma.emissionFactor.upsert({
      where: { activityId: factor.activityId },
      update: factor,
      create: factor,
    });
  }
  console.log(`${emissionFactors.length} emission factors created`);

  console.log('\nDatabase seed completed!');
  console.log('\nAccounts:');
  console.log('   demo@urimpact.sa / Demo@2026');
  console.log('   komal@urimpact.sa / Komal@121102');
  console.log('   b.aldelewy@urimpact.sa / Admin@123');
  console.log('   data@urimpact.sa / Admin@1234');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
