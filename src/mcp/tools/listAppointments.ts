import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppointmentService } from '../../services/appointmentService.ts';
import { requireUser } from '../auth.ts';

const AppointmentSchema = z.object({
    id: z.string(),
    professional: z.object({
        id: z.number(),
        name: z.string(),
        specialty: z.string(),
    }),
    patientName: z.string(),
    reason: z.string().nullable(),
    datetime: z.string(),
    createdAt: z.string(),
});

// Mesma forma de resposta do GET /appointments (server.ts) — nenhuma tool MCP
// inventa um formato novo de dado que já existe e é usado em outro lugar.
export function registerListAppointmentsTool(server: McpServer, appointmentService: AppointmentService) {
    server.registerTool(
        'list_appointments',
        {
            title: 'List appointments',
            description: 'Lists all appointments for the authenticated user, ordered by date ascending.',
            inputSchema: {
                authToken: z.string().describe('Bearer token obtained via /auth/signin or /auth/signup'),
            },
            outputSchema: {
                appointments: z.array(AppointmentSchema),
            },
        },
        async ({ authToken }) => {
            try {
                const user = await requireUser(authToken);
                const appointments = await appointmentService.getAppointmentsForUser(user.id);

                const mapped = appointments.map((appointment) => ({
                    id: appointment.id,
                    professional: {
                        id: appointment.professional.id,
                        name: appointment.professional.name,
                        specialty: appointment.professional.specialty,
                    },
                    patientName: appointment.patientName,
                    reason: appointment.reason,
                    datetime: appointment.datetime.toISOString(),
                    createdAt: appointment.createdAt.toISOString(),
                }));

                return {
                    content: [{ type: 'text', text: JSON.stringify(mapped, null, 2) }],
                    structuredContent: { appointments: mapped },
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{
                        type: 'text',
                        text: error instanceof Error ? error.message : 'Unknown error while listing appointments',
                    }],
                };
            }
        },
    );
}
