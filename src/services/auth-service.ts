import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import authRepository from '../repositories/auth-repository.ts';
import { errors } from '../utils/httpErrors.ts';
import type { SignupDTO, SigninDTO } from '../schemas/auth-schema.ts';

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw errors.internalServerError(`${name} is not set in environment variables`);
  }
  return value;
}

export async function signup(dto: SignupDTO) {
  const pepper = requireEnv('ENCRYPT_PEPPER');
  const jwtSecret = requireEnv('JWT_SECRET');

  const existing = await authRepository.findUniqueByEmail(dto.email);
  if (existing) {
    throw errors.conflict('Email already in use');
  }

  const passwordHash = await bcrypt.hash(dto.password + pepper, 10);
  const user = await authRepository.createUser({
    name: dto.name,
    email: dto.email,
    passwordHash,
  });

  const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '7d' });
  await authRepository.insertSession({ userId: user.id, token });

  return { token };
}

export async function signin(dto: SigninDTO) {
  const pepper = requireEnv('ENCRYPT_PEPPER');
  const jwtSecret = requireEnv('JWT_SECRET');

  const user = await authRepository.findUniqueByEmail(dto.email);
  if (!user) {
    throw errors.unauthorized('Invalid credentials');
  }

  const validPassword = await bcrypt.compare(dto.password + pepper, user.passwordHash);
  if (!validPassword) {
    throw errors.unauthorized('Invalid credentials');
  }

  const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '7d' });
  await authRepository.insertSession({ userId: user.id, token });

  return { token };
}

export async function signout(token: string) {
  await authRepository.deactivateSession(token);
}
