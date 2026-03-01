import { PrismaClient } from '@prisma/client';
import { config } from './index.js';

// Create Prisma client with logging based on environment
const prisma = new PrismaClient({
  log: config.isProduction
    ? ['error']
    : ['query', 'info', 'warn', 'error'],
});

// Handle connection events
prisma.$connect()
  .then(() => {
    console.log('✅ Database connected successfully');
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export { prisma };
export default prisma;
