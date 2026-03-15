import { PrismaClient, UserRole, DocumentType, DocumentStatus, EmissionScope, EmissionCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Create Super Admin user
  const superAdminPassword = await hashPassword('SuperAdmin123!');
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@urimpact.com' },
    update: {},
    create: {
      email: 'superadmin@urimpact.com',
      password: superAdminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      company: 'URIMPACT',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`✅ Super Admin created: ${superAdmin.email}`);

  // Create Admin user
  const adminPassword = await hashPassword('Admin123!');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@urimpact.com' },
    update: {},
    create: {
      email: 'admin@urimpact.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      company: 'URIMPACT',
      role: UserRole.ADMINISTRATOR,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`✅ Admin created: ${admin.email}`);

  // Create Demo user
  const demoPassword = await hashPassword('Demo123!');
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@urimpact.com' },
    update: {},
    create: {
      email: 'demo@urimpact.com',
      password: demoPassword,
      firstName: 'Demo',
      lastName: 'User',
      company: 'Demo Company LLC',
      role: UserRole.DATA_CONTRIBUTOR,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`✅ Demo User created: ${demoUser.email}`);

  // Create sample emission factors
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
  console.log(`✅ ${emissionFactors.length} emission factors created`);

  // Create sample documents for demo user
  const documents = [
    {
      userId: demoUser.id,
      fileName: 'dewa_bill_january_2024.pdf',
      fileType: 'application/pdf',
      fileSize: 245000,
      filePath: 'sample_dewa_bill.pdf',
      documentType: DocumentType.UTILITY_BILL,
      status: DocumentStatus.COMPLETED,
      extractedData: {
        provider: 'DEWA',
        region: 'AE-DU',
        consumption: 45230,
        consumptionUnit: 'kWh',
        amount: 15500,
        currency: 'AED',
        billingPeriodStart: '2024-01-01',
        billingPeriodEnd: '2024-01-31',
      },
      processedAt: new Date(),
    },
    {
      userId: demoUser.id,
      fileName: 'dewa_bill_february_2024.pdf',
      fileType: 'application/pdf',
      fileSize: 238000,
      filePath: 'sample_dewa_bill_feb.pdf',
      documentType: DocumentType.UTILITY_BILL,
      status: DocumentStatus.COMPLETED,
      extractedData: {
        provider: 'DEWA',
        region: 'AE-DU',
        consumption: 42150,
        consumptionUnit: 'kWh',
        amount: 14200,
        currency: 'AED',
        billingPeriodStart: '2024-02-01',
        billingPeriodEnd: '2024-02-29',
      },
      processedAt: new Date(),
    },
    {
      userId: demoUser.id,
      fileName: 'fuel_receipt_march_2024.jpg',
      fileType: 'image/jpeg',
      fileSize: 125000,
      filePath: 'sample_fuel_receipt.jpg',
      documentType: DocumentType.FUEL_RECEIPT,
      status: DocumentStatus.COMPLETED,
      extractedData: {
        fuelType: 'diesel',
        quantity: 150,
        quantityUnit: 'L',
        amount: 450,
        currency: 'AED',
        documentDate: '2024-03-15',
      },
      processedAt: new Date(),
    },
  ];

  for (const doc of documents) {
    await prisma.document.create({ data: doc });
  }
  console.log(`✅ ${documents.length} sample documents created`);

  // Create sample emissions for demo user
  const emissions = [
    {
      userId: demoUser.id,
      scope: EmissionScope.SCOPE_2,
      category: EmissionCategory.ELECTRICITY,
      activityType: 'electricity',
      activityAmount: 45230,
      activityUnit: 'kWh',
      region: 'AE-DU',
      co2e: 18092,
      co2: 17187,
      ch4: 0.45,
      n2o: 0.045,
      emissionFactor: 0.4,
      emissionFactorUnit: 'kg/kWh',
      dataSource: 'Emissions API',
      dataYear: 2024,
      billingPeriodStart: new Date('2024-01-01'),
      billingPeriodEnd: new Date('2024-01-31'),
      calculatedAt: new Date('2024-02-01'),
    },
    {
      userId: demoUser.id,
      scope: EmissionScope.SCOPE_2,
      category: EmissionCategory.ELECTRICITY,
      activityType: 'electricity',
      activityAmount: 42150,
      activityUnit: 'kWh',
      region: 'AE-DU',
      co2e: 16860,
      co2: 16017,
      ch4: 0.42,
      n2o: 0.042,
      emissionFactor: 0.4,
      emissionFactorUnit: 'kg/kWh',
      dataSource: 'Emissions API',
      dataYear: 2024,
      billingPeriodStart: new Date('2024-02-01'),
      billingPeriodEnd: new Date('2024-02-29'),
      calculatedAt: new Date('2024-03-01'),
    },
    {
      userId: demoUser.id,
      scope: EmissionScope.SCOPE_1,
      category: EmissionCategory.FUEL_COMBUSTION,
      activityType: 'diesel',
      activityAmount: 150,
      activityUnit: 'L',
      region: 'AE',
      co2e: 405,
      co2: 402,
      ch4: 0.015,
      n2o: 0.015,
      emissionFactor: 2.7,
      emissionFactorUnit: 'kg/L',
      dataSource: 'DEFRA',
      dataYear: 2024,
      calculatedAt: new Date('2024-03-15'),
    },
    {
      userId: demoUser.id,
      scope: EmissionScope.SCOPE_2,
      category: EmissionCategory.ELECTRICITY,
      activityType: 'electricity',
      activityAmount: 48500,
      activityUnit: 'kWh',
      region: 'AE-DU',
      co2e: 19400,
      co2: 18430,
      ch4: 0.49,
      n2o: 0.049,
      emissionFactor: 0.4,
      emissionFactorUnit: 'kg/kWh',
      dataSource: 'Emissions API',
      dataYear: 2024,
      billingPeriodStart: new Date('2024-03-01'),
      billingPeriodEnd: new Date('2024-03-31'),
      calculatedAt: new Date('2024-04-01'),
    },
    {
      userId: demoUser.id,
      scope: EmissionScope.SCOPE_1,
      category: EmissionCategory.FUEL_COMBUSTION,
      activityType: 'diesel',
      activityAmount: 200,
      activityUnit: 'L',
      region: 'AE',
      co2e: 540,
      co2: 536,
      ch4: 0.02,
      n2o: 0.02,
      emissionFactor: 2.7,
      emissionFactorUnit: 'kg/L',
      dataSource: 'DEFRA',
      dataYear: 2024,
      calculatedAt: new Date('2024-04-10'),
    },
  ];

  for (const emission of emissions) {
    await prisma.emission.create({ data: emission });
  }
  console.log(`✅ ${emissions.length} sample emissions created`);

  // Create sample audit logs
  const auditLogs = [
    {
      userId: demoUser.id,
      action: 'USER_LOGIN',
      resource: 'user',
      resourceId: demoUser.id,
      details: { email: demoUser.email },
      ipAddress: '192.168.1.1',
    },
    {
      userId: demoUser.id,
      action: 'DOCUMENT_UPLOADED',
      resource: 'document',
      details: { fileName: 'dewa_bill_january_2024.pdf' },
      ipAddress: '192.168.1.1',
    },
    {
      userId: demoUser.id,
      action: 'EMISSION_CALCULATED',
      resource: 'emission',
      details: { activityType: 'electricity', co2e: 18092 },
      ipAddress: '192.168.1.1',
    },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({ data: log });
  }
  console.log(`✅ ${auditLogs.length} audit logs created`);

  console.log('\n🎉 Database seed completed successfully!');
  console.log('\n📋 Test Accounts:');
  console.log('   Super Admin: superadmin@urimpact.com / SuperAdmin123!');
  console.log('   Admin:       admin@urimpact.com / Admin123!');
  console.log('   Demo User:   demo@urimpact.com / Demo123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
