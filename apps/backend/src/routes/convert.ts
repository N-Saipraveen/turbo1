import express from 'express';
import { ConvertRequestSchema } from '../lib/zodSchemas.js';
import { convertSqlToJson } from '../services/sqlToJson.js';
import { convertSqlToMongo } from '../services/sqlToMongo.js';
import { convertJsonToSql } from '../services/jsonToSql.js';
import { convertMongoToSql } from '../services/mongoToSql.js';
import { aiRefineMapping } from '../services/ai.js';
import { logger } from '../lib/logger.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    // Validate request
    const validation = ConvertRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { from, to, content, options } = validation.data;
    const dialect = options?.dialect || 'postgres';
    const useAi = options?.ai || false;

    logger.info(`Converting ${from} to ${to}`, { dialect, useAi });

    let result: any;

    // Route to appropriate converter
    if (from === 'sql' && to === 'json') {
      result = await convertSqlToJson(
        content,
        dialect as 'postgres' | 'mysql' | 'sqlite'
      );
    } else if (from === 'sql' && to === 'mongo') {
      result = await convertSqlToMongo(
        content,
        dialect as 'postgres' | 'mysql' | 'sqlite'
      );
    } else if (from === 'json' && to === 'sql') {
      result = await convertJsonToSql(
        content,
        dialect as 'postgres' | 'mysql' | 'sqlite'
      );
    } else if (from === 'mongo' && to === 'sql') {
      result = await convertMongoToSql(
        content,
        dialect as 'postgres' | 'mysql' | 'sqlite'
      );
    } else if (from === 'json' && to === 'mongo') {
      // JSON to Mongo conversion
      result = {
        artifacts: { 'output.json': content },
        summary: { info: 'JSON is already compatible with MongoDB' },
        warnings: ['Direct import to MongoDB recommended'],
      };
    } else if (from === 'mongo' && to === 'json') {
      // Mongo to JSON conversion
      result = {
        artifacts: { 'output.json': content },
        summary: { info: 'MongoDB documents are JSON-compatible' },
        warnings: [],
      };
    } else if (from === 'sql' && to === 'sql') {
      // SQL to SQL (dialect conversion)
      result = {
        artifacts: { 'output.sql': content },
        summary: { info: 'Same format - no conversion needed' },
        warnings: ['Consider using a SQL dialect converter for cross-database compatibility'],
      };
    } else {
      return res.status(400).json({
        error: `Conversion from ${from} to ${to} not yet implemented`,
      });
    }

    // Apply AI refinement if requested
    if (useAi && result.summary) {
      try {
        const aiSummary = JSON.stringify(result.summary);
        const aiResponse = await aiRefineMapping(aiSummary);
        result.aiSuggestions = aiResponse;
      } catch (error) {
        logger.error('AI refinement failed', error);
        result.warnings.push('AI refinement unavailable - using deterministic mapping only');
      }
    }

    return res.json(result);
  } catch (error) {
    logger.error('Conversion failed', error);
    return res.status(500).json({
      error: 'Conversion failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
