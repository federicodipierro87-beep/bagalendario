import { z } from 'zod';

// Messaggi di validazione zod in italiano per tutta l'applicazione.
z.config(z.locales.it());

const EnvSchema = z.object({
  NODE_ENV: z.string().default('production'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL mancante'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve avere almeno 16 caratteri'),
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN mancante'),
  PUBLIC_API_URL: z.string().url().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_NOME: z.string().default('Amministratore'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variabili d’ambiente non valide:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGIN.split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
};

export const TIMEZONE = 'Europe/Rome';
