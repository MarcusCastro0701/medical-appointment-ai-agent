import { prisma } from '../config/index.ts';

async function findUniqueByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

async function createUser(data: { name: string; email: string; passwordHash: string }) {
  return prisma.user.create({ data });
}

async function insertSession(data: { userId: number; token: string }) {
  return prisma.session.create({ data });
}

async function deactivateSession(token: string) {
  return prisma.session.updateMany({
    where: { token, isActive: true },
    data: { isActive: false },
  });
}

async function findActiveSessionByToken(token: string) {
  return prisma.session.findFirst({
    where: { token, isActive: true },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

const authRepository = {
  findUniqueByEmail,
  createUser,
  insertSession,
  deactivateSession,
  findActiveSessionByToken,
};

export default authRepository;
