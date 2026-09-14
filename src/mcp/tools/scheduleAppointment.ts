import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppointmentService } from '../../services/appointmentService.ts';
import { requireUser } from '../auth.ts';

// no timezone hack like schedulerNode chat
// datetime is parsed literally needs its own offset
export function registerScheduleAppointmentTool(server: McpServer, appointmentService: AppointmentService) {
    server.registerTool(
        'schedule_appointment',
        {
            title: 'Schedule appointment',
            description: 'Schedules a new appointment with a professional. The professional/datetime slot must be free — the same professional cannot have two appointments at the exact same datetime.',
            inputSchema: {
                authToken: z.string().describe('Bearer token obtained via /auth/signin or /auth/signup'),
                professionalId: z.number().describe('Id of the professional, as returned by the professionals list'),
                datetime: z.string()
                    .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'datetime must be a valid ISO 8601 string, including timezone offset' })
                    .describe('Appointment date and time, ISO 8601 with timezone offset, e.g. 2026-11-20T14:00:00-03:00'),
                patientName: z.string().min(1).describe('Name of the patient the appointment is for'),
                reason: z.string().optional().describe('Reason for the visit. Defaults to "general consultation" if omitted.'),
            },
            outputSchema: {
                id: z.string(),
                professionalId: z.number(),
                patientName: z.string(),
                reason: z.string().nullable(),
                datetime: z.string(),
                createdAt: z.string(),
            },
        },
        async ({ authToken, professionalId, datetime, patientName, reason }) => {
            try {
                const user = await requireUser(authToken);

                const appointment = await appointmentService.bookAppointment(
                    professionalId,
                    new Date(datetime),
                    patientName,
                    reason ?? 'general consultation',
                    user.id,
                );

                const mapped = {
                    id: appointment.id,
                    professionalId: appointment.professionalId,
                    patientName: appointment.patientName,
                    reason: appointment.reason,
                    datetime: appointment.datetime.toISOString(),
                    createdAt: appointment.createdAt.toISOString(),
                };

                return {
                    content: [{ type: 'text', text: JSON.stringify(mapped, null, 2) }],
                    structuredContent: mapped,
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{
                        type: 'text',
                        text: error instanceof Error ? error.message : 'Unknown error while scheduling appointment',
                    }],
                };
            }
        },
    );
}
