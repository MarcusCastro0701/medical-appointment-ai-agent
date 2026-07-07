import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from '../src/server.ts';
import { professionals } from '../src/services/appointmentService.ts';
import { prisma } from '../src/config/index.ts';

const app = createServer();
let authToken: string;

async function makeARequest(question: string, chatId?: string) {
    return await app.inject({
        method: 'POST',
        url: '/chat',
        headers: {
            authorization: `Bearer ${authToken}`,
        },
        payload: {
            question,
            ...(chatId ? { chatId } : {}),
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

         const scheduleResponse = await makeARequest(
            `Sou Joao da Silva e quero agendar uma consulta com ${professionals.at(1)?.name} para hoje às 14h`
        )
        const chatId = JSON.parse(scheduleResponse.body).chatId;

        const response = await makeARequest(
            `Cancele minha consulta com ${professionals.at(1)?.name} que tenho hoje às 14h, me chamo Joao da Silva`,
            chatId
        );

        console.log('Cancel Success Response:', response.body);

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.chatId, chatId);
        assert.equal(body.intent, 'cancel');
        assert.equal(body.success, true);
    });

    it('Chat history - persists across calls and is listable', async () => {
        const r1 = await makeARequest('Olá, gostaria de saber mais sobre os profissionais disponíveis');
        const chatId = JSON.parse(r1.body).chatId;

        await makeARequest('Pode repetir, por favor?', chatId);

        const listResponse = await app.inject({
            method: 'GET',
            url: '/chats',
            headers: { authorization: `Bearer ${authToken}` },
        });
        const chats = JSON.parse(listResponse.body);
        assert.ok(chats.some((c: { id: string }) => c.id === chatId));

        const detailResponse = await app.inject({
            method: 'GET',
            url: `/chats/${chatId}`,
            headers: { authorization: `Bearer ${authToken}` },
        });
        assert.equal(detailResponse.statusCode, 200);
        const detail = JSON.parse(detailResponse.body);
        assert.equal(detail.messages.length, 4);
        assert.equal(detail.messages[0].role, 'human');
        assert.equal(detail.messages[1].role, 'ai');
    });

    it('Chat message limit - blocks new messages once reached', async () => {
        const r1 = await makeARequest('Olá, só testando o limite de mensagens');
        const chatId = JSON.parse(r1.body).chatId;

        await prisma.chat.update({ where: { id: chatId }, data: { messageCount: 20 } });

        const response = await makeARequest('Mais uma mensagem depois do limite', chatId);
        assert.equal(response.statusCode, 409);
        const body = JSON.parse(response.body);
        assert.equal(body.error, 'CONFLICT');
    });
});
