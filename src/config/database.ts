import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

export const prisma = new PrismaClient();

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
}
