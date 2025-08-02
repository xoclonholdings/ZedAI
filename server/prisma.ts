import { PrismaClient } from '@prisma/client';

// Global PrismaClient instance to avoid multiple connections
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = globalThis.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Test database connection
export async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('[ORACLE] Database connection established successfully');
    return true;
  } catch (error) {
    console.error('[ORACLE] Database connection failed:', error);
    return false;
  }
}

// Graceful disconnect
export async function disconnectDatabase() {
  await prisma.$disconnect();
}

export default prisma;