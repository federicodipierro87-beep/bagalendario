import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok', time: new Date().toISOString() });
  } catch (err) {
    console.error('Health check: database non raggiungibile', err);
    res.status(503).json({ status: 'error', db: 'unreachable', time: new Date().toISOString() });
  }
});
