import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Informe seu nome completo.'),
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
  phone: z.string().optional(),
});
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const symptomSchema = z.object({
  description: z.string().min(3, 'Descreva o sintoma.'),
  severity: z.coerce.number().int().min(1).max(5),
});
export type SymptomFormValues = z.infer<typeof symptomSchema>;
