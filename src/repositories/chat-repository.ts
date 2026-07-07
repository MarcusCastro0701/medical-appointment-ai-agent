import { prisma } from '../config/index.ts';

async function createChat(userId: number) {
  return prisma.chat.create({ data: { userId } });
}

async function findById(id: string) {
  return prisma.chat.findUnique({ where: { id } });
}

async function findAllByUser(userId: number) {
  return prisma.chat.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

async function incrementMessageCount(id: string, by: number) {
  return prisma.chat.update({
    where: { id },
    data: { messageCount: { increment: by } },
  });
}

const chatRepository = {
  createChat,
  findById,
  findAllByUser,
  incrementMessageCount,
};

export default chatRepository;
