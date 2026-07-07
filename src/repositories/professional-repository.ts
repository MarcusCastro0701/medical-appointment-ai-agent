import { prisma } from '../config/index.ts';

async function findAll() {
  return prisma.professional.findMany({ orderBy: { id: 'asc' } });
}

const professionalRepository = {
  findAll,
};

export default professionalRepository;
