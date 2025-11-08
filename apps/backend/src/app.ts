import express from 'express';
import cors from 'cors';
import { logger } from './lib/logger.js';
import healthRouter from './routes/health.js';
import convertRouter from './routes/convert.js';
import analyzeRouter from './routes/analyze.js';
import migrateRouter from './routes/migrate.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/health', healthRouter);
app.use('/api/convert', convertRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/migrate', migrateRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

export default app;
