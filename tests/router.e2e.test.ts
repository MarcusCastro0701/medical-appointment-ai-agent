import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createServer } from '../src/server.ts';
import { prisma } from '../src/config/index.ts';

const app = createServer();
let authToken: string;
let professionals: { id: number; name: string; specialty: string }[];

const TEST_PATIENT_NAMES = [
    'Maria Santos', 'Joao da Silva', 'Carlos Menezes', 'Fernanda Lima', 'Roberto Alves',
    'Marina Duarte', 'Test User', 'Antonio Ferreira', 'Lucas Prado', 'Beatriz Nunes', 'Otavio Ramos',
];

async function signupWithEmail() {
    const email = `test-${randomUUID()}@example.com`;
    const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
            name: 'Test User',
            email,
            password: 'test1234',
        },
    });
    return { token: JSON.parse(response.body).token as string, email };
}

async function signup() {
    const { token } = await signupWithEmail();
    return token;
}

function userIdFromToken(token: string): number {
    const decoded = jwt.decode(token) as { userId: number };
    return decoded.userId;
}

async function makeARequest(question: string, chatId?: string, token: string = authToken) {
    return await app.inject({
        method: 'POST',
        url: '/chat',
        headers: {
            authorization: `Bearer ${token}`,
        },
        payload: {
            question,
            ...(chatId ? { chatId } : {}),
        },
    });
}

/** Sends a message that should trigger a schedule/cancel proposal, then confirms it with "sim". Returns both responses. */
async function proposeAndConfirm(question: string, chatId: string | undefined, token: string = authToken) {
    const proposeResponse = await makeARequest(question, chatId, token);
    const proposeBody = JSON.parse(proposeResponse.body);
    const confirmResponse = await makeARequest('sim, pode confirmar', proposeBody.chatId, token);
    return { proposeResponse, proposeBody, confirmResponse, confirmBody: JSON.parse(confirmResponse.body) };
}

describe('Medical Appointment System - E2E Tests', async () => {

    before(async () => {
        authToken = await signup();

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
    });

    after(async () => {
        await prisma.appointment.deleteMany({
            where: { patientName: { in: TEST_PATIENT_NAMES } },
        });
    });

    it('Schedule appointment - proposes then executes on confirmation', async () => {
        const { proposeBody, confirmBody } = await proposeAndConfirm(
            `Olá, sou Maria Santos e quero agendar uma consulta com ${professionals.at(0)?.name} para amanhã às 16h para um check-up regular`,
            undefined
        );

        console.log('Schedule Propose Response:', JSON.stringify(proposeBody));
        console.log('Schedule Confirm Response:', JSON.stringify(confirmBody));

        assert.equal(proposeBody.intent, 'schedule');
        assert.equal(proposeBody.success, false, 'must not book before confirmation');

        assert.equal(confirmBody.intent, 'schedule');
        assert.equal(confirmBody.success, true);
    });

    it('Cancel appointment - proposes then executes on confirmation', async () => {
        const schedule = await proposeAndConfirm(
            `Sou Joao da Silva e quero agendar uma consulta com ${professionals.at(1)?.name} para hoje às 14h`,
            undefined
        );
        const chatId = schedule.confirmBody.chatId;
        assert.equal(schedule.confirmBody.success, true);

        const cancel = await proposeAndConfirm(
            `Cancele minha consulta com ${professionals.at(1)?.name} que tenho hoje às 14h, me chamo Joao da Silva`,
            chatId
        );

        console.log('Cancel Propose Response:', JSON.stringify(cancel.proposeBody));
        console.log('Cancel Confirm Response:', JSON.stringify(cancel.confirmBody));

        assert.equal(cancel.proposeBody.success, false, 'must not cancel before confirmation');
        assert.equal(cancel.confirmBody.chatId, chatId);
        assert.equal(cancel.confirmBody.intent, 'cancel');
        assert.equal(cancel.confirmBody.success, true);
    });

    it('Cancel appointment - denied when requested by a different user', async () => {
        const schedule = await proposeAndConfirm(
            `Sou Carlos Menezes e quero agendar uma consulta com ${professionals.at(0)?.name} para hoje às 18h`,
            undefined
        );
        assert.equal(schedule.confirmBody.success, true);

        const otherUserToken = await signup();
        const response = await makeARequest(
            `Cancele minha consulta com ${professionals.at(0)?.name} que tenho hoje às 18h, me chamo Carlos Menezes`,
            undefined,
            otherUserToken
        );

        console.log('Cross-user cancel Response:', response.body);

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.success, false, 'the other user has no such appointment in their own list, so nothing can even be proposed');
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

    it('List appointments - reflects real data and is isolated per user', async () => {
        const schedule = await proposeAndConfirm(
            `Sou Fernanda Lima e quero agendar uma consulta com ${professionals.at(0)?.name} para hoje às 9h`,
            undefined
        );
        assert.equal(schedule.confirmBody.success, true);
        const chatId = schedule.confirmBody.chatId;

        const listResp = await makeARequest('Quais consultas eu tenho marcadas?', chatId);
        console.log('List appointments Response:', listResp.body);
        const listBody = JSON.parse(listResp.body);
        assert.equal(listBody.intent, 'list_appointments');
        assert.equal(listBody.success, true);

        const otherUserToken = await signup();
        const otherUserId = userIdFromToken(otherUserToken);

        const otherListResp = await makeARequest('Quais consultas eu tenho marcadas?', undefined, otherUserToken);
        console.log('Other user list Response:', otherListResp.body);
        const otherListBody = JSON.parse(otherListResp.body);
        assert.equal(otherListBody.intent, 'list_appointments');
        assert.equal(otherListBody.success, true);

        const otherUserAppointments = await prisma.appointment.count({ where: { userId: otherUserId } });
        assert.equal(otherUserAppointments, 0, 'a fresh user must never see another user\'s appointments');
    });

    it('Cancel by reference to a just-listed appointment, without restating the exact date/time', async () => {
        const schedule = await proposeAndConfirm(
            `Sou Roberto Alves e quero agendar uma consulta com ${professionals.at(0)?.name} para hoje às 21h`,
            undefined
        );
        assert.equal(schedule.confirmBody.success, true);
        const chatId = schedule.confirmBody.chatId;

        const listResponse = await makeARequest('Quais consultas eu tenho marcadas?', chatId);
        console.log('List before reference-cancel:', listResponse.body);

        const cancel = await proposeAndConfirm(
            `Cancela a consulta que você acabou de listar com ${professionals.at(0)?.name}`,
            chatId
        );
        console.log('Cancel-by-reference Propose:', JSON.stringify(cancel.proposeBody));
        console.log('Cancel-by-reference Confirm:', JSON.stringify(cancel.confirmBody));
        assert.equal(cancel.confirmBody.intent, 'cancel');
        assert.equal(cancel.confirmBody.success, true);

        const remaining = await prisma.appointment.count({ where: { patientName: 'Roberto Alves' } });
        assert.equal(remaining, 0);
    });

    it('Ambiguous cancel - proposal must be confirmed before deleting anything, and declining prevents any deletion', async () => {
        const s1 = await proposeAndConfirm(
            `Sou Marina Duarte e quero agendar uma consulta com ${professionals.at(0)?.name} para hoje às 7h`,
            undefined
        );
        assert.equal(s1.confirmBody.success, true);
        const chatId = s1.confirmBody.chatId;

        const s2 = await proposeAndConfirm(
            `Sou Marina Duarte e quero agendar outra consulta com ${professionals.at(1)?.name} para hoje às 22h`,
            chatId
        );
        assert.equal(s2.confirmBody.success, true);

        const cancelPropose = await makeARequest('Cancele minha consulta', chatId);
        console.log('Ambiguous cancel proposal:', cancelPropose.body);
        assert.equal(JSON.parse(cancelPropose.body).success, false, 'must never execute on the first, ambiguous message');

        const declineResponse = await makeARequest('não, na verdade deixa quieto', chatId);
        console.log('Decline Response:', declineResponse.body);
        assert.equal(JSON.parse(declineResponse.body).success, false);

        const remaining = await prisma.appointment.count({ where: { patientName: 'Marina Duarte' } });
        assert.equal(remaining, 2, 'declining must not delete anything, even if the proposal had guessed the wrong appointment');
    });

    it('Declining a schedule proposal does not create an appointment', async () => {
        const proposeResponse = await makeARequest(
            `Sou Lucas Prado e quero agendar uma consulta com ${professionals.at(0)?.name} para hoje às 5h`
        );
        const chatId = JSON.parse(proposeResponse.body).chatId;
        assert.equal(JSON.parse(proposeResponse.body).success, false);

        const declineResponse = await makeARequest('não, deixa pra lá', chatId);
        console.log('Decline schedule Response:', declineResponse.body);
        assert.equal(JSON.parse(declineResponse.body).success, false);

        const created = await prisma.appointment.count({ where: { patientName: 'Lucas Prado' } });
        assert.equal(created, 0, 'declining must not create the appointment');
    });

    it('An unrelated message during a pending confirmation drops the proposal and answers the real question', async () => {
        const proposeResponse = await makeARequest(
            `Sou Beatriz Nunes e quero agendar uma consulta com ${professionals.at(1)?.name} para hoje às 4h`
        );
        const chatId = JSON.parse(proposeResponse.body).chatId;
        assert.equal(JSON.parse(proposeResponse.body).success, false);

        const unrelatedResponse = await makeARequest('Quais profissionais vocês têm?', chatId);
        console.log('Unrelated-during-pending Response:', unrelatedResponse.body);
        const unrelatedBody = JSON.parse(unrelatedResponse.body);
        assert.ok(
            professionals.some((p) => unrelatedBody.reply.includes(p.name)),
            'should answer the real question instead of forcing a yes/no read on an unrelated message'
        );

        const lateConfirm = await makeARequest('sim, pode confirmar', chatId);
        console.log('Late confirm after unrelated Response:', lateConfirm.body);

        const created = await prisma.appointment.count({ where: { patientName: 'Beatriz Nunes' } });
        assert.equal(created, 0, 'the expired proposal must not be booked by an unrelated later "sim"');
    });

    it('Understands informal/slangy confirmation and decline phrasing', async () => {
        const r1 = await makeARequest(
            `Sou Otavio Ramos e quero agendar uma consulta com ${professionals.at(0)?.name} para hoje às 3h`
        );
        const chatId1 = JSON.parse(r1.body).chatId;
        const c1 = await makeARequest('siiiiiiiiiiiimimimimim', chatId1);
        console.log('Informal yes Response:', c1.body);
        assert.equal(JSON.parse(c1.body).success, true, 'informal elongated "sim" should be understood as confirmation');

        const r2 = await makeARequest(
            `Sou Otavio Ramos e quero agendar uma consulta com ${professionals.at(1)?.name} para hoje às 2h`
        );
        const chatId2 = JSON.parse(r2.body).chatId;
        const c2 = await makeARequest('nem a pauuuuu não não', chatId2);
        console.log('Informal no Response:', c2.body);
        assert.equal(JSON.parse(c2.body).success, false, 'informal emphatic negation should be understood as a decline');

        const createdCount = await prisma.appointment.count({ where: { patientName: 'Otavio Ramos' } });
        assert.equal(createdCount, 1, 'only the confirmed appointment should exist');
    });

    it('Schedule without stating a patient name falls back to the authenticated user', async () => {
        const { confirmBody } = await proposeAndConfirm(
            `Marca uma consulta comigo com ${professionals.at(1)?.name} hoje às 6h`,
            undefined
        );
        console.log('Implicit patient name Response:', JSON.stringify(confirmBody));
        assert.equal(confirmBody.intent, 'schedule');
        assert.equal(confirmBody.success, true);

        const created = await prisma.appointment.findFirst({
            where: { professionalId: professionals.at(1)!.id, patientName: 'Test User' },
        });
        assert.ok(created, 'expected an appointment booked under the authenticated user\'s own name');
    });

    it('Scheduling for someone else uses the explicitly named patient, not the authenticated user', async () => {
        const { confirmBody } = await proposeAndConfirm(
            `Marca uma consulta pro meu pai, Antonio Ferreira, com ${professionals.at(0)?.name} hoje às 8h`,
            undefined
        );
        console.log('Explicit third-party patient Response:', JSON.stringify(confirmBody));
        assert.equal(confirmBody.intent, 'schedule');
        assert.equal(confirmBody.success, true);

        const created = await prisma.appointment.findFirst({
            where: { professionalId: professionals.at(0)!.id, patientName: 'Antonio Ferreira' },
        });
        assert.ok(created, 'expected the appointment to be booked under the explicitly named third party, not "Test User"');
    });

    it('Answers general questions about the authenticated user and available professionals', async () => {
        const { token, email } = await signupWithEmail();

        const nameResponse = await makeARequest('Sabe me dizer qual o meu nome?', undefined, token);
        console.log('Own name Response:', nameResponse.body);
        const nameBody = JSON.parse(nameResponse.body);
        assert.ok(nameBody.reply.includes('Test User'), 'reply should state the authenticated user\'s real name');
        const chatId = nameBody.chatId;

        const emailResponse = await makeARequest('Consegue dizer o meu email?', chatId, token);
        console.log('Own email Response:', emailResponse.body);
        const emailBody = JSON.parse(emailResponse.body);
        assert.ok(emailBody.reply.includes(email), 'reply should state the authenticated user\'s real email');

        const professionalsResponse = await makeARequest('Quais profissionais estão disponíveis?', chatId, token);
        console.log('Available professionals Response:', professionalsResponse.body);
        const professionalsBody = JSON.parse(professionalsResponse.body);
        assert.ok(
            professionals.some((p) => professionalsBody.reply.includes(p.name)),
            'reply should mention at least one real professional by name'
        );
    });

    it('Scheduling without naming any professional does not guess one', async () => {
        const response = await makeARequest('Agende uma consulta às 15h do dia 8 de julho, por favor');
        console.log('No-professional schedule Response:', response.body);
        const body = JSON.parse(response.body);
        assert.equal(body.success, false, 'must not silently propose (or book) with a guessed professional');

        const created = await prisma.appointment.count({
            where: { datetime: new Date('2026-07-08T15:00:00.000Z') },
        });
        assert.equal(created, 0, 'no appointment should have been created for this slot');
    });
});
