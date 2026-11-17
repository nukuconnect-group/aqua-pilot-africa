import { z } from 'zod';

/**
 * User creation validation schema
 * Enforces proper email format, password strength, and name constraints
 */
export const userCreationSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Format d\'email invalide')
    .max(255, 'L\'email doit contenir moins de 255 caractères'),
  
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une lettre majuscule')
    .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une lettre minuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
    .regex(/[!@#$%^&*()_+\-=\x5b\]{};':"\\|,.<>\x2f?]/, 'Le mot de passe doit contenir au moins un caractère spécial'),
  
  full_name: z
    .string()
    .trim()
    .min(1, 'Le nom complet est requis')
    .max(100, 'Le nom doit contenir moins de 100 caractères'),
  
  role: z.enum(['admin', 'moderator', 'user'], {
    errorMap: () => ({ message: 'Rôle invalide' })
  })
});

export type UserCreationInput = z.infer<typeof userCreationSchema>;
