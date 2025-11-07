/**
 * Batch Insert Helper
 *
 * High-performance batch insert using:
 * - Multi-row INSERT statements
 * - Connection pooling
 * - Automatic chunking for large datasets
 * - Progress callbacks
 *
 * Inspired by:
 * - node-postgres bulk insert patterns
 * - Prisma batch operations
 * - dbmate migration patterns
 */

import { MigrationLogger } from './migrationLogger.js';

export interface BatchInsertOptions {
  batchSize?: number; // Default: 1000
  chunkSize?: number; // Default: 10000 (for very large datasets)
  logger?: MigrationLogger;
  onProgress?: (inserted: number, total: number) => void;
}

export interface InsertRecord {
  [key: string]: any;
}

/**
 * Batch insert records into PostgreSQL
 */
export async function batchInsertPostgres(
  client: any,
  tableName: string,
  records: InsertRecord[],
  options: BatchInsertOptions = {}
): Promise<{ inserted: number; duration: number }> {
  const {
    batchSize = 1000,
    logger,
    onProgress,
  } = options;

  if (records.length === 0) {
    return { inserted: 0, duration: 0 };
  }

  const startTime = Date.now();
  let totalInserted = 0;

  // Extract column names from first record
  const columns = Object.keys(records[0]);
  const columnList = columns.map(c => `"${c}"`).join(', ');

  logger?.debug('batch-insert', `Starting batch insert for ${tableName}`, {
    totalRecords: records.length,
    batchSize,
    columns: columns.length,
  });

  // Process in batches
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, Math.min(i + batchSize, records.length));
    const batchStartTime = Date.now();

    // Build multi-row VALUES clause
    const valuesClauses: string[] = [];
    const allValues: any[] = [];
    let paramIndex = 1;

    for (const record of batch) {
      const recordValues: string[] = [];

      for (const column of columns) {
        let value = record[column];

        // Handle undefined/null
        if (value === undefined || value === null) {
          recordValues.push('NULL');
        } else {
          // Convert MongoDB ObjectId to string
          if (value && typeof value === 'object' && value.toString) {
            value = value.toString();
          }

          recordValues.push(`$${paramIndex}`);
          allValues.push(value);
          paramIndex++;
        }
      }

      valuesClauses.push(`(${recordValues.join(', ')})`);
    }

    // Build and execute INSERT statement
    const sql = `INSERT INTO "${tableName}" (${columnList}) VALUES ${valuesClauses.join(', ')}`;

    try {
      await client.query(sql, allValues);

      totalInserted += batch.length;
      const batchDuration = Date.now() - batchStartTime;

      logger?.logBatchInsert(tableName, batch.length, batchDuration);

      onProgress?.(totalInserted, records.length);
    } catch (error) {
      logger?.error('batch-insert', `Batch insert failed for ${tableName}`, error as Error, {
        batchStart: i,
        batchSize: batch.length,
        sql: sql.substring(0, 500),
      });
      throw error;
    }
  }

  const totalDuration = Date.now() - startTime;

  logger?.info('batch-insert', `Completed batch insert for ${tableName}`, {
    totalInserted,
    duration: `${totalDuration}ms`,
    rowsPerSecond: Math.round((totalInserted / totalDuration) * 1000),
  });

  return { inserted: totalInserted, duration: totalDuration };
}

/**
 * Batch insert records into MySQL
 */
export async function batchInsertMySQL(
  connection: any,
  tableName: string,
  records: InsertRecord[],
  options: BatchInsertOptions = {}
): Promise<{ inserted: number; duration: number }> {
  const {
    batchSize = 1000,
    logger,
    onProgress,
  } = options;

  if (records.length === 0) {
    return { inserted: 0, duration: 0 };
  }

  const startTime = Date.now();
  let totalInserted = 0;

  // Extract column names from first record
  const columns = Object.keys(records[0]);
  const columnList = columns.map(c => `\`${c}\``).join(', ');

  logger?.debug('batch-insert', `Starting batch insert for ${tableName}`, {
    totalRecords: records.length,
    batchSize,
  });

  // Process in batches
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, Math.min(i + batchSize, records.length));
    const batchStartTime = Date.now();

    // Build multi-row VALUES clause
    const valuesClauses: string[] = [];
    const allValues: any[] = [];

    for (const record of batch) {
      const recordPlaceholders: string[] = [];

      for (const column of columns) {
        let value = record[column];

        // Convert MongoDB ObjectId to string
        if (value && typeof value === 'object' && value.toString) {
          value = value.toString();
        }

        recordPlaceholders.push('?');
        allValues.push(value);
      }

      valuesClauses.push(`(${recordPlaceholders.join(', ')})`);
    }

    // Build and execute INSERT statement
    const sql = `INSERT INTO \`${tableName}\` (${columnList}) VALUES ${valuesClauses.join(', ')}`;

    try {
      await connection.query(sql, allValues);

      totalInserted += batch.length;
      const batchDuration = Date.now() - batchStartTime;

      logger?.logBatchInsert(tableName, batch.length, batchDuration);

      onProgress?.(totalInserted, records.length);
    } catch (error) {
      logger?.error('batch-insert', `Batch insert failed for ${tableName}`, error as Error);
      throw error;
    }
  }

  const totalDuration = Date.now() - startTime;
  return { inserted: totalInserted, duration: totalDuration };
}

/**
 * Batch insert records into SQLite
 */
export function batchInsertSQLite(
  db: any,
  tableName: string,
  records: InsertRecord[],
  options: BatchInsertOptions = {}
): { inserted: number; duration: number } {
  const {
    batchSize = 1000,
    logger,
    onProgress,
  } = options;

  if (records.length === 0) {
    return { inserted: 0, duration: 0 };
  }

  const startTime = Date.now();
  let totalInserted = 0;

  // Extract column names from first record
  const columns = Object.keys(records[0]);
  const columnList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map(() => '?').join(', ');

  logger?.debug('batch-insert', `Starting batch insert for ${tableName}`, {
    totalRecords: records.length,
    batchSize,
  });

  // Prepare statement (SQLite benefits from prepared statements for batch inserts)
  const sql = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;
  const stmt = db.prepare(sql);

  // Process in batches with transactions
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, Math.min(i + batchSize, records.length));
    const batchStartTime = Date.now();

    try {
      const insertMany = db.transaction((records: InsertRecord[]) => {
        for (const record of records) {
          const values = columns.map(col => {
            let value = record[col];
            // Convert MongoDB ObjectId to string
            if (value && typeof value === 'object' && value.toString) {
              value = value.toString();
            }
            return value;
          });
          stmt.run(...values);
        }
      });

      insertMany(batch);

      totalInserted += batch.length;
      const batchDuration = Date.now() - batchStartTime;

      logger?.logBatchInsert(tableName, batch.length, batchDuration);

      onProgress?.(totalInserted, records.length);
    } catch (error) {
      logger?.error('batch-insert', `Batch insert failed for ${tableName}`, error as Error);
      throw error;
    }
  }

  const totalDuration = Date.now() - startTime;
  return { inserted: totalInserted, duration: totalDuration };
}

/**
 * Universal batch insert that detects the database type
 */
export async function batchInsert(
  connection: any,
  dbType: 'postgres' | 'mysql' | 'sqlite',
  tableName: string,
  records: InsertRecord[],
  options: BatchInsertOptions = {}
): Promise<{ inserted: number; duration: number }> {
  switch (dbType) {
    case 'postgres':
      return await batchInsertPostgres(connection, tableName, records, options);
    case 'mysql':
      return await batchInsertMySQL(connection, tableName, records, options);
    case 'sqlite':
      return batchInsertSQLite(connection, tableName, records, options);
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}
