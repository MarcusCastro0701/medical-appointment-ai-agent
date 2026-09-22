import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { signup } from '../src/services/auth-service.ts';
import { prisma } from '../src/config/index.ts';

let client: Client;
let authToken: string;
let professionals: { id: number; name: string; specialty: string }[];

const TEST_PATIENT_NAMES = ['Mcp Patient One', 'Mcp Patient Two', 'Mcp Patient Three', 'Mcp Patient Four', 'Mcp Patient Five'];

async function signupUser() {
    const { token } = await signup({
        name: 'Mcp Test User',
        email: `mcp-test-${randomUUID()}@example.com`,
        password: 'test1234',
    });
    return token;
}

async function callTool(name: string, args: Record<string, unknown>) {
    return client.callTool({ name, arguments: args });
}

describe('Medical Appointment MCP Server - E2E Tests', async () => {

    before(async () => {
        authToken = await signupUser();

        const [p1, p2] = await Promise.all([
            prisma.professional.upsert({
                where: { id: 1 },
                update: {},
                create: { id: 1, name: 'Dr. Alicio da Silva', specialty: 'Cardiologia' },
            }),
            prisma.professional.upsert({
                where: { id: 2 },
                update: {},
                create: { id: 2, name: 'Dra. Ana Pereira', specialty: 'Dermatologia' },
            }),
        ]);
        professionals = [p1, p2];

        const transport = new StdioClientTransport({
            command: 'node',
            args: ['--env-file', '.env', 'src/mcp/server.ts'],
        });
        client = new Client({ name: 'mcp-e2e-tests', version: '1.0.0' });
        await client.connect(transport);
    });

    after(async () => {
        await client.close();
        await prisma.appointment.deleteMany({
            where: { patientName: { in: TEST_PATIENT_NAMES } },
        });
    });

    it('lists the tools and the resource', async () => {
        const tools = await client.listTools();
        const names = tools.tools.map((t) => t.name);
        assert.ok(names.includes('list_appointments'));
        assert.ok(names.includes('cancel_appointment'));
        assert.ok(names.includes('schedule_appointment'));

        const resources = await client.listResources();
        assert.ok(resources.resources.some((r) => r.uri === 'professionals://list'));
    });

    it('schedule_appointment books a real appointment and blocks a conflicting slot', async () => {
        const result = await callTool('schedule_appointment', {
            authToken,
            professionalId: professionals[0].id,
            datetime: '2026-12-10T10:00:00-03:00',
            patientName: 'Mcp Patient One',
        });

        console.log('Schedule result:', result.structuredContent);
        assert.equal(result.isError, undefined);
        const created = result.structuredContent as { id: string };
        assert.ok(created.id);

        const conflict = await callTool('schedule_appointment', {
            authToken,
            professionalId: professionals[0].id,
            datetime: '2026-12-10T10:00:00-03:00',
            patientName: 'Someone Else',
        });
        assert.equal(conflict.isError, true);
    });

    it('list_appointments only returns the authenticated user own appointments', async () => {
        await callTool('schedule_appointment', {
            authToken,
            professionalId: professionals[1].id,
            datetime: '2026-12-11T09:00:00-03:00',
            patientName: 'Mcp Patient Two',
        });

        const own = await callTool('list_appointments', { authToken });
        const ownList = (own.structuredContent as { appointments: { patientName: string }[] }).appointments;
        assert.ok(ownList.some((a) => a.patientName === 'Mcp Patient Two'));

        const otherToken = await signupUser();
        const other = await callTool('list_appointments', { authToken: otherToken });
        const otherList = (other.structuredContent as { appointments: unknown[] }).appointments;
        assert.equal(otherList.length, 0);
    });

    it('cancel_appointment removes the appointment and rejects unknown or foreign ids', async () => {
        const scheduled = await callTool('schedule_appointment', {
            authToken,
            professionalId: professionals[0].id,
            datetime: '2026-12-12T11:00:00-03:00',
            patientName: 'Mcp Patient Three',
        });
        const appointmentId = (scheduled.structuredContent as { id: string }).id;

        const otherToken = await signupUser();
        const foreignCancel = await callTool('cancel_appointment', { authToken: otherToken, appointmentId });
        assert.equal(foreignCancel.isError, true);

        const cancelled = await callTool('cancel_appointment', { authToken, appointmentId });
        assert.equal(cancelled.isError, undefined);

        const cancelledAgain = await callTool('cancel_appointment', { authToken, appointmentId });
        assert.equal(cancelledAgain.isError, true);
    });

    it('schedule_appointment rejects an invalid datetime before touching the database', async () => {
        const result = await callTool('schedule_appointment', {
            authToken,
            professionalId: professionals[0].id,
            datetime: 'not-a-date',
            patientName: 'Mcp Patient Four',
        });
        console.log('Invalid datetime result:', result.content?.[0]);
        assert.equal(result.isError, true);

        const created = await prisma.appointment.count({ where: { patientName: 'Mcp Patient Four' } });
        assert.equal(created, 0);
    });

    it('schedule_appointment defaults reason to general consultation when omitted', async () => {
        const result = await callTool('schedule_appointment', {
            authToken,
            professionalId: professionals[1].id,
            datetime: '2026-12-13T08:00:00-03:00',
            patientName: 'Mcp Patient Five',
        });
        const created = result.structuredContent as { reason: string };
        assert.equal(created.reason, 'general consultation');
    });

    it('professionals resource lists the real seeded professionals', async () => {
        const read = await client.readResource({ uri: 'professionals://list' });
        const list = JSON.parse(read.contents[0].text as string) as { id: number; name: string }[];
        assert.ok(list.some((p) => p.id === professionals[0].id && p.name === professionals[0].name));
        assert.ok(list.some((p) => p.id === professionals[1].id && p.name === professionals[1].name));
    });
});
