import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppointmentService } from '../../services/appointmentService.ts';
import { requireUser } from '../auth.ts';

// no confirmation step here caller already sends the exact id
// cancelAppointment rejects ids not owned by the user
export function registerCancelAppointmentTool(server: McpServer, appointmentService: AppointmentService) {
    server.registerTool(
        'cancel_appointment',
        {
            title: 'Cancel appointment',
            description: 'Cancels an existing appointment by id. The appointment must belong to the authenticated user; call list_appointments first to find the correct id.',
            inputSchema: {
                authToken: z.string().describe('Bearer token obtained via /auth/signin or /auth/signup'),
                appointmentId: z.string().describe('Id of the appointment to cancel, as returned by list_appointments'),
            },
            outputSchema: {
                cancelled: z.boolean(),
                appointmentId: z.string(),
            },
        },
        async ({ authToken, appointmentId }) => {
            try {
                const user = await requireUser(authToken);
                await appointmentService.cancelAppointment(appointmentId, user.id);

                return {
                    content: [{ type: 'text', text: `Appointment ${appointmentId} cancelled successfully.` }],
                    structuredContent: { cancelled: true, appointmentId },
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{
                        type: 'text',
                        text: error instanceof Error ? error.message : 'Unknown error while cancelling appointment',
                    }],
                };
            }
        },
    );
}
