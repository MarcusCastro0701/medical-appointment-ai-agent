import { Prisma } from '@prisma/client';
import professionalRepository from '../repositories/professional-repository.ts';
import appointmentRepository from '../repositories/appointment-repository.ts';

export class AppointmentService {

    async getProfessionals() {
        return professionalRepository.findAll();
    }

    async bookAppointment(professionalId: number, date: Date, patientName: string, reason: string, userId: number) {
        try {
            return await appointmentRepository.create({
                professionalId,
                userId,
                patientName,
                reason,
                datetime: date,
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new Error('Horário indisponível para este profissional');
            }
            throw error;
        }
    }

    async cancelAppointment(appointmentId: string, userId: number) {
        const { count } = await appointmentRepository.removeForUser(appointmentId, userId);

        if (count === 0) {
            throw new Error('Agendamento não encontrado para cancelamento');
        }
    }

    async getAppointmentsForUser(userId: number) {
        return appointmentRepository.findAllByUserId(userId);
    }

}
