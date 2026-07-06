import { HumanMessage } from 'langchain';
import { buildGraph } from './graph/factory.ts';

import Fastify from 'fastify';
import { authRouter } from './routers/auth-router.ts';
import { authenticate } from './middlewares/authentication-middleware.ts';
import { AppError } from './utils/httpErrors.ts';

const graph = buildGraph();

export const createServer = () => {
    const app = Fastify();

    app.setErrorHandler((error, request, reply) => {
        if (error instanceof AppError) {
            return reply.status(error.statusCode).send({
                error: error.code,
                message: error.message,
                details: error.details,
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
        schema: {
            body: {
                type: 'object',
                required: ['question'],
                properties: {
                    question: { type: 'string', minLength: 10 },
                },
            }
        }
    }, async function (request, reply) {
        const { question } = request.body as {
            question: string;
        };

        const response = await graph.invoke({
            messages: [new HumanMessage(question)],
        });

        const lastMessage = response.messages.at(-1);

        return {
            reply: lastMessage?.content ?? '',
            intent: response.intent ?? 'unknown',
            success: response.actionSuccess ?? true,
        };
    });

    return app;
};
