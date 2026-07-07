import { HumanMessage } from 'langchain';
import { buildGraph } from './graph/factory.ts';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { authRouter } from './routers/auth-router.ts';
import { authenticate } from './middlewares/authentication-middleware.ts';
import { AppError, errors } from './utils/httpErrors.ts';
import chatRepository from './repositories/chat-repository.ts';
import { maxChatMessages } from './config/index.ts';

const graph = await buildGraph();

export const createServer = () => {
    const app = Fastify();

    app.register(cors, {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    });

    app.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
    });

    app.setErrorHandler((error, request, reply) => {
        if (error instanceof AppError) {
            return reply.status(error.statusCode).send({
                error: error.code,
                message: error.message,
                details: error.details,
            });
        }

        if (error.statusCode && error.statusCode < 500) {
            return reply.status(error.statusCode).send({
                error: error.code ?? (error.statusCode === 429 ? 'TOO_MANY_REQUESTS' : 'BAD_REQUEST'),
                message: error.message,
            });
        }

        request.log.error(error);
        return reply.status(500).send({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'An error occurred while processing your request.',
        });
    });

    app.register(authRouter);

    app.post('/chat', {
        preHandler: [authenticate],
        config: {
            rateLimit: {
                max: 10,
                timeWindow: '1 minute',
            },
        },
        schema: {
            body: {
                type: 'object',
                required: ['question'],
                properties: {
                    question: { type: 'string', minLength: 10, maxLength: 500 },
                    chatId: { type: 'string' },
                },
            }
        }
    }, async function (request, reply) {
        const { question, chatId } = request.body as {
            question: string;
            chatId?: string;
        };

        const chat = chatId
            ? await chatRepository.findById(chatId)
            : await chatRepository.createChat(request.user!.id);

        if (!chat || chat.userId !== request.user!.id) {
            throw errors.notFound('Chat not found');
        }

        if (chat.messageCount >= maxChatMessages) {
            throw errors.conflict('This chat has reached its message limit. Please start a new chat.');
        }

        const response = await graph.invoke(
            { messages: [new HumanMessage(question)] },
            { configurable: { thread_id: chat.id } },
        );

        await chatRepository.incrementMessageCount(chat.id, 2);

        const lastMessage = response.messages.at(-1);

        return {
            chatId: chat.id,
            reply: lastMessage?.content ?? '',
            intent: response.intent ?? 'unknown',
            success: response.actionSuccess ?? true,
        };
    });

    app.get('/chats', { preHandler: [authenticate] }, async (request) => {
        return chatRepository.findAllByUser(request.user!.id);
    });

    app.get('/chats/:id', { preHandler: [authenticate] }, async (request) => {
        const { id } = request.params as { id: string };

        const chat = await chatRepository.findById(id);
        if (!chat || chat.userId !== request.user!.id) {
            throw errors.notFound('Chat not found');
        }

        const state = await graph.getState({ configurable: { thread_id: id } });
        const messages = (state.values.messages ?? []).map((message: any) => ({
            role: message.getType(),
            content: message.content,
        }));

        return { chatId: chat.id, messages };
    });

    return app;
};
