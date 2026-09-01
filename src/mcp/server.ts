import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';


const server = new McpServer({
    name: 'medical-appointment-mcp',
    version: '1.0.0',
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('Medical Appointment MCP server rodando via stdio');
}

main().catch((error) => {
    console.error('Falha ao iniciar o servidor MCP:', error);
    process.exit(1);
});
