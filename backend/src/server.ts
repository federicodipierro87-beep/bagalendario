import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`Bagalendario API in ascolto sulla porta ${config.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} ricevuto, chiusura in corso...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
