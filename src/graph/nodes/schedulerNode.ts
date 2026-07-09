import { AppointmentService } from '../../services/appointmentService.ts';
import type { GraphState } from '../graph.ts';
import { z } from 'zod/v3';

const ScheduleRequiredFieldsSchema = z.object({
  professionalId: z.number({ required_error: 'Professional ID is required' }),
  datetime: z.string({ required_error: 'Appointment datetime is required' }),
  patientName: z.string({ required_error: 'Patient name is required' }),
  userId: z.number({ required_error: 'Authenticated user is required' }),
});

export function createSchedulerNode(appointmentService: AppointmentService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {

    // confirmed: execute using the fields already stored in state
    if (state.awaitingConfirmation === 'schedule' && state.confirmed) {
      console.log(`📅 Confirmed — scheduling appointment...`);
      try {
        const validation = ScheduleRequiredFieldsSchema.safeParse(state)
        if (!validation.success) {
          const errorMessages = validation.error.errors.map(e => e.message).join(', ')
          return { actionSuccess: false, actionError: errorMessages, awaitingConfirmation: undefined };
        }

        const appointment = await appointmentService.bookAppointment(
          validation.data.professionalId,
          new Date(validation.data.datetime),
          validation.data.patientName,
          state.reason ?? 'general consultation',
          validation.data.userId
        )

        console.log(`✅ Appointment scheduled successfully`);
        return {
          actionSuccess: true,
          appointmentData: appointment,
          awaitingConfirmation: undefined,
        };
      } catch (error) {
        console.log(`❌ Scheduling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return {
          actionSuccess: false,
          actionError: error instanceof Error ? error.message : 'Scheduling failed',
          awaitingConfirmation: undefined,
        };
      }
    }

    console.log(`📅 Preparing appointment proposal...`);
    const validation = ScheduleRequiredFieldsSchema.safeParse(state)

    if (!validation.success) {
      const errorMessages = validation.error.errors.map(e => e.message).join(', ')
      console.log(`⚠️  Validation failed: ${errorMessages}`);
      return {
        actionSuccess: false,
        actionError: errorMessages,
        awaitingConfirmation: undefined,
      }
    }

    console.log(`❓ Proposal ready, awaiting confirmation`);
    return {
      awaitingConfirmation: 'schedule',
      actionSuccess: false,
    };
  };
}
