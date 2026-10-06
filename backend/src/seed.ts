// Seed idempotente: crea l'utente ADMIN iniziale se non esiste già.
// Eseguito in pre-deploy su Railway dopo `prisma migrate deploy`.
import { config } from './config.js';
import { hashPassword, normalizeEmail } from './lib/auth.js';
import { prisma } from './lib/prisma.js';

async function main() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NOME } = config;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('Seed: ADMIN_EMAIL/ADMIN_PASSWORD non impostate, nessun admin creato.');
    return;
  }

  const email = normalizeEmail(ADMIN_EMAIL);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed: l'utente ${email} esiste già, nessuna modifica.`);
    return;
  }

  await prisma.user.create({
    data: { email, nome: ADMIN_NOME, ruolo: 'ADMIN', passwordHash: await hashPassword(ADMIN_PASSWORD) },
  });
  console.log(`Seed: creato utente ADMIN ${email}.`);
}

main()
  .catch((err) => {
    console.error('Seed fallito:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
