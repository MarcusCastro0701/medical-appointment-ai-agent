import authRepository from '../repositories/auth-repository.ts';

// Mesma verificação que o middleware Fastify (authentication-middleware.ts) faz,
// só que como função pura reaproveitável pelas tools MCP — sem depender de
// FastifyRequest/FastifyReply, já que aqui o token chega como parâmetro da tool,
// não como header HTTP.
export async function requireUser(authToken: string) {
    const session = await authRepository.findActiveSessionByToken(authToken);

    if (!session) {
        throw new Error('Invalid or expired session');
    }

    return session.user;
}
