import express from 'express';
import { z } from 'zod';
import { testDatabaseConnection, type DatabaseConnection } from '../services/dbConnection.js';
import { introspectDatabaseSchema } from '../services/schemaIntrospection.js';
import { MigrationEngine, type MigrationConfig } from '../services/migration.js';
import { previewJsonMigration, executeJsonMigration } from '../services/jsonMigration.js';
import { logger } from '../lib/logger.js';

const router = express.Router();

// Store active migrations
const activeMigrations = new Map<string, MigrationEngine>();

// Zod schemas for validation
const DatabaseConnectionSchema = z.object({
  type: z.enum(['postgres', 'mysql', 'sqlite', 'mongodb', 'json']),
  host: z.string().optional(),
  port: z.number().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  filePath: z.string().optional(),
  uri: z.string().optional(),
  jsonData: z.any().optional(),
});

const MigrationRequestSchema = z.object({
  source: DatabaseConnectionSchema,
  target: DatabaseConnectionSchema,
  tables: z.array(z.string()),
  batchSize: z.number().optional(),
});

// Test database connection
router.post('/test-connection', async (req, res) => {
  try {
    const validation = DatabaseConnectionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid connection parameters',
        details: validation.error.errors,
      });
    }

    const connection: DatabaseConnection = validation.data as any;
    const result = await testDatabaseConnection(connection);

    return res.json(result);
  } catch (error) {
    logger.error('Connection test failed', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Introspect database schema
router.post('/introspect-schema', async (req, res) => {
  try {
    const validation = DatabaseConnectionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid connection parameters',
        details: validation.error.errors,
      });
    }

    const connection: DatabaseConnection = validation.data as any;
    const schema = await introspectDatabaseSchema(connection);

    return res.json({
      success: true,
      schema,
    });
  } catch (error) {
    logger.error('Schema introspection failed', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start migration
router.post('/start-migration', async (req, res) => {
  try {
    const validation = MigrationRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid migration parameters',
        details: validation.error.errors,
      });
    }

    const config: MigrationConfig = validation.data as any;
    const migrationId = Date.now().toString();

    const migration = new MigrationEngine(config);
    activeMigrations.set(migrationId, migration);

    // Set up event listeners
    const logs: any[] = [];
    const progress: any[] = [];

    migration.on('log', (log) => {
      logs.push(log);
    });

    migration.on('progress', (prog) => {
      const index = progress.findIndex((p) => p.table === prog.table);
      if (index >= 0) {
        progress[index] = prog;
      } else {
        progress.push(prog);
      }
    });

    // Execute migration in background
    migration.execute().then((result) => {
      setTimeout(() => {
        activeMigrations.delete(migrationId);
      }, 60000); // Keep for 1 minute after completion
    });

    return res.json({
      success: true,
      migrationId,
      message: 'Migration started',
    });
  } catch (error) {
    logger.error('Migration start failed', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get migration status
router.get('/migration-status/:id', (req, res) => {
  const migrationId = req.params.id;
  const migration = activeMigrations.get(migrationId);

  if (!migration) {
    return res.status(404).json({
      error: 'Migration not found',
    });
  }

  return res.json({
    logs: migration.getLogs(),
    progress: migration.getProgress(),
  });
});

// Stream migration logs (SSE)
router.get('/migration-stream/:id', (req, res) => {
  const migrationId = req.params.id;
  const migration = activeMigrations.get(migrationId);

  if (!migration) {
    return res.status(404).json({
      error: 'Migration not found',
    });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send existing logs
  migration.getLogs().forEach((log) => {
    res.write(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`);
  });

  migration.getProgress().forEach((prog) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', data: prog })}\n\n`);
  });

  // Listen for new events
  const logHandler = (log: any) => {
    res.write(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`);
  };

  const progressHandler = (prog: any) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', data: prog })}\n\n`);
  };

  migration.on('log', logHandler);
  migration.on('progress', progressHandler);

  // Clean up on client disconnect
  req.on('close', () => {
    migration.off('log', logHandler);
    migration.off('progress', progressHandler);
  });
});

// Preview JSON migration
router.post('/preview-json-migration', async (req, res) => {
  try {
    const { jsonData, targetType } = req.body;

    if (!jsonData || !targetType) {
      return res.status(400).json({
        error: 'JSON data and target type are required',
      });
    }

    if (!['postgres', 'mysql', 'sqlite', 'mongodb'].includes(targetType)) {
      return res.status(400).json({
        error: 'Invalid target database type',
      });
    }

    const preview = await previewJsonMigration(jsonData, targetType);
    return res.json(preview);
  } catch (error) {
    logger.error('JSON migration preview failed', error);
    return res.status(500).json({
      error: 'Failed to generate preview',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Execute JSON migration
router.post('/execute-json-migration', async (req, res) => {
  try {
    const { jsonData, targetConnection } = req.body;

    if (!jsonData || !targetConnection) {
      return res.status(400).json({
        error: 'JSON data and target connection are required',
      });
    }

    const validation = DatabaseConnectionSchema.safeParse(targetConnection);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid target connection parameters',
        details: validation.error.errors,
      });
    }

    const result = await executeJsonMigration(
      jsonData,
      validation.data as DatabaseConnection
    );

    return res.json(result);
  } catch (error) {
    logger.error('JSON migration execution failed', error);
    return res.status(500).json({
      error: 'Migration failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
