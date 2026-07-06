import type { FastifyRequest, FastifyReply } from 'fastify';
import authRepository from '../repositories/auth-repository.ts';
import { errors } from '../utils/httpErrors.ts';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: number;
      name: string;
      email: string;
    };
  }
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    throw errors.unauthorized('Missing Authorization header');
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw errors.unauthorized('Invalid Authorization header');
  }

  const session = await authRepository.findActiveSessionByToken(token);
  if (!session) {
    throw errors.unauthorized('Invalid or expired session');
  }

  request.user = session.user;
}
