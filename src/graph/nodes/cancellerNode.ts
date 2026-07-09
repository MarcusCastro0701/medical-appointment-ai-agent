import { AppointmentService } from '../../services/appointmentService.ts';
import type { GraphState } from '../graph.ts';
import { z } from 'zod/v3';

const CancelRequiredFieldsSchema = z.object({
  appointmentId: z.string({ required_error: 'No specific appointment could be identified' }),
  userId: z.number({ required_error: 'Authenticated user is required' }),
});

export function createCancellerNode(appointmentService: AppointmentService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {

    if (state.awaitingConfirmation === 'cancel' && state.confirmed) {
      console.log(`❌ Confirmed — cancelling appointment...`);
      try {
        const validation = CancelRequiredFieldsSchema.safeParse(state)
        if (!validation.success) {
          const errorMessages = validation.error.errors.map(e => e.message).join(', ')
          return { actionSuccess: false, actionError: errorMessages, awaitingConfirmation: undefined };
        }

        await appointmentService.cancelAppointment(
          validation.data.appointmentId,
          validation.data.userId
        )

        return {
          actionSuccess: true,
          awaitingConfirmation: undefined,
        };
      } catch (error) {
        console.log(`❌ Cancellation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return {
          actionSuccess: false,
          actionError: error instanceof Error ? error.message : 'Cancellation failed',
          awaitingConfirmation: undefined,
        };
      }
    }

    console.log(`❌ Preparing cancellation proposal...`);
    const validation = CancelRequiredFieldsSchema.safeParse(state)
    if (!validation.success) {
      const errorMessages = validation.error.errors.map(e => e.message).join(', ')
      console.log(`⚠️  Validation failed: ${errorMessages}`);
      return {
        actionSuccess: false,
        actionError: errorMessages,
        awaitingConfirmation: undefined,
      }
    }

    const matchedAppointment = state.appointmentsList?.find(
      (appointment) => appointment.id === validation.data.appointmentId
    );

    console.log(`❓ Proposal ready, awaiting confirmation`);
    return {
      awaitingConfirmation: 'cancel',
      actionSuccess: false,
      professionalName: matchedAppointment?.professionalName ?? state.professionalName,
      datetime: matchedAppointment?.datetime ?? state.datetime,
      patientName: matchedAppointment?.patientName ?? state.patientName,
    };
  };
}
