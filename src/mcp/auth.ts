import authRepository from '../repositories/auth-repository.ts';

// same check as fastify middleware just no http here
export async function requireUser(authToken: string) {
    const session = await authRepository.findActiveSessionByToken(authToken);

    if (!session) {
        throw new Error('Invalid or expired session');
    }

    return session.user;
}
