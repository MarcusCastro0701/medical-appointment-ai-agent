import type { FastifyInstance } from 'fastify';
import { signupSchema, signinSchema } from '../schemas/auth-schema.ts';
import * as authService from '../services/auth-service.ts';
import { authenticate } from '../middlewares/authentication-middleware.ts';
import { errors } from '../utils/httpErrors.ts';

export async function authRouter(app: FastifyInstance) {
  app.post('/auth/signup', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      throw errors.badRequest('Validation error', parsed.error.flatten());
    }

    const result = await authService.signup(parsed.data);
    reply.code(201);
    return result;
  });

  app.post('/auth/signin', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = signinSchema.safeParse(request.body);
    if (!parsed.success) {
      throw errors.badRequest('Validation error', parsed.error.flatten());
    }

    return authService.signin(parsed.data);
  });

  app.post('/auth/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const token = request.headers.authorization!.split(' ')[1]!;
    await authService.signout(token);
    reply.code(204);
    return null;
  });
}
