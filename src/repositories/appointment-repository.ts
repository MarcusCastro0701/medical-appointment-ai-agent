import { prisma } from '../config/index.ts';

async function findAllByUserId(userId: number) {
  return prisma.appointment.findMany({
    where: { userId },
    include: { professional: true },
    orderBy: { datetime: 'asc' },
  });
}

async function create(data: {
  professionalId: number;
  userId: number;
  patientName: string;
  reason: string;
  datetime: Date;
}) {
  return prisma.appointment.create({ data });
}

async function removeForUser(id: string, userId: number) {
  return prisma.appointment.deleteMany({ where: { id, userId } });
}

const appointmentRepository = {
  findAllByUserId,
  create,
  removeForUser,
};

export default appointmentRepository;
