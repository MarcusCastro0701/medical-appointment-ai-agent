import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AppointmentService } from '../services/appointmentService.ts';
import { registerListAppointmentsTool } from './tools/listAppointments.ts';
import { registerCancelAppointmentTool } from './tools/cancelAppointment.ts';
import { registerScheduleAppointmentTool } from './tools/scheduleAppointment.ts';

const appointmentService = new AppointmentService();

const server = new McpServer({
    name: 'medical-appointment-mcp',
    version: '1.0.0',
});

registerListAppointmentsTool(server, appointmentService);
registerCancelAppointmentTool(server, appointmentService);
registerScheduleAppointmentTool(server, appointmentService);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('Medical Appointment MCP server rodando via stdio');
}

main().catch((error) => {
    console.error('Falha ao iniciar o servidor MCP:', error);
    process.exit(1);
});
