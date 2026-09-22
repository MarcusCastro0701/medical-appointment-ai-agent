import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppointmentService } from '../../services/appointmentService.ts';

export function registerProfessionalsResource(server: McpServer, appointmentService: AppointmentService) {
    server.registerResource(
        'professionals',
        'professionals://list',
        {
            title: 'Professionals',
            description: 'List of professionals available for scheduling, with id and specialty',
            mimeType: 'application/json',
        },
        async (uri) => {
            const professionals = await appointmentService.getProfessionals();

            const mapped = professionals.map((professional) => ({
                id: professional.id,
                name: professional.name,
                specialty: professional.specialty,
            }));

            return {
                contents: [{
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify(mapped, null, 2),
                }],
            };
        },
    );
}
