import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(3).max(100),
  email: z.string().email(),
  password: z.string().min(6),
});

export const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type SignupDTO = z.infer<typeof signupSchema>;
export type SigninDTO = z.infer<typeof signinSchema>;
