import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from '../src/server.ts';
import { professionals } from '../src/services/appointmentService.ts';

const app = createServer();
let authToken: string;

async function makeARequest(question: string) {
    return await app.inject({
        method: 'POST',
        url: '/chat',
        headers: {
            authorization: `Bearer ${authToken}`,
        },
        payload: {
            question,
        },
    });
}

describe('Medical Appointment System - E2E Tests', async () => {

    before(async () => {
        const email = `test-${randomUUID()}@example.com`;
        const signupResponse = await app.inject({
            method: 'POST',
            url: '/auth/signup',
            payload: {
                name: 'Test User',
                email,
                password: 'test1234',
            },
        });

        const { token } = JSON.parse(signupResponse.body);
        authToken = token;
    });

    it('Schedule appointment - Success', async () => {
        const response = await makeARequest(
            `Olá, sou Maria Santos e quero agendar uma consulta com ${professionals.at(0)?.name} para amanhã às 16h para um check-up regular`
        )

        console.log('Schedule Success Response:', response.body);

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.intent, 'schedule');
        assert.equal(body.success, true);
    });


    it('Cancel appointment - Success', async () => {

         await makeARequest(
            `Sou Joao da Silva e quero agendar uma consulta com ${professionals.at(1)?.name} para hoje às 14h`
        )

        const response = await makeARequest(
            `Cancele minha consulta com ${professionals.at(1)?.name} que tenho hoje às 14h, me chamo Joao da Silva`
        );

        console.log('Cancel Success Response:', response.body);

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.intent, 'cancel');
        assert.equal(body.success, true);
    });
});
