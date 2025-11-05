import express from 'express';
import { AnalyzeRequestSchema } from '../lib/zodSchemas.js';
import { parseSql } from '../services/sql.js';
import { parseMongoSchema } from '../services/mongo.js';
import { parseJson, inferSchemaFromData } from '../services/json.js';
import { logger } from '../lib/logger.js';

const router = express.Router();

interface GraphNode {
  id: string;
  label: string;
  type: 'table' | 'collection' | 'schema';
  data: any;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: 'foreign_key' | 'reference' | 'relationship';
}

router.post('/', async (req, res) => {
  try {
    const validation = AnalyzeRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { content, type } = validation.data;

    logger.info(`Analyzing ${type} schema`);

    let nodes: GraphNode[] = [];
    let edges: GraphEdge[] = [];

    if (type === 'sql') {
      const tables = parseSql(content);

      // Create nodes for each table
      for (const table of tables) {
        nodes.push({
          id: table.name,
          label: table.name,
          type: 'table',
          data: {
            columns: table.columns.length,
            primaryKeys: table.primaryKeys,
            indexes: table.indexes.length,
          },
        });
      }

      // Create edges for foreign keys
      for (const table of tables) {
        for (const fk of table.foreignKeys) {
          edges.push({
            id: `${table.name}_${fk.column}_${fk.referencedTable}`,
            source: table.name,
            target: fk.referencedTable,
            label: `${fk.column} → ${fk.referencedColumn}`,
            type: 'foreign_key',
          });
        }
      }
    } else if (type === 'mongo') {
      const schemas = parseMongoSchema(content);

      for (const schema of schemas) {
        nodes.push({
          id: schema.collection,
          label: schema.collection,
          type: 'collection',
          data: {
            fields: schema.fields.length,
            indexes: schema.indexes?.length || 0,
          },
        });
      }
    } else if (type === 'json') {
      const data = parseJson(content);
      const schema = inferSchemaFromData(data);

      nodes.push({
        id: 'root',
        label: schema.title || 'Root Schema',
        type: 'schema',
        data: {
          properties: Object.keys(schema.properties || {}).length,
          required: schema.required?.length || 0,
        },
      });

      // Create nodes for nested objects
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if ((propSchema as any).type === 'object') {
            nodes.push({
              id: propName,
              label: propName,
              type: 'schema',
              data: propSchema,
            });

            edges.push({
              id: `root_${propName}`,
              source: 'root',
              target: propName,
              label: 'contains',
              type: 'relationship',
            });
          }
        }
      }
    }

    return res.json({ nodes, edges });
  } catch (error) {
    logger.error('Analysis failed', error);
    return res.status(500).json({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
