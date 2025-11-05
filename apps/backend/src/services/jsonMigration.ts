import { convertJsonToSql } from './jsonToSql.js';
import { convertJsonToMongo } from './jsonToMongo.js';
import { DatabaseConnection, getDatabaseConnection, closeDatabaseConnection } from './dbConnection.js';

export interface JsonMigrationPreview {
  success: boolean;
  schema?: string;
  sampleData?: any[];
  sampleInserts?: string[];
  tableCount?: number;
  recordCount?: number;
  error?: string;
}

/**
 * Generate a preview of what the migration will create
 */
export async function previewJsonMigration(
  jsonData: any,
  targetType: 'postgres' | 'mysql' | 'sqlite' | 'mongodb'
): Promise<JsonMigrationPreview> {
  try {
    const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];

    if (targetType === 'mongodb') {
      const result = await convertJsonToMongo(JSON.stringify(jsonData));

      // Combine all artifacts into a single schema string
      const schema = Object.values(result.artifacts).join('\n\n');

      // Generate sample inserts for preview
      const sampleInserts = dataArray.slice(0, 5).map((record, i) =>
        `db.collection.insertOne(${JSON.stringify(record, null, 2)})`
      );

      return {
        success: true,
        schema,
        sampleData: dataArray.slice(0, 5),
        sampleInserts,
        tableCount: 1,
        recordCount: dataArray.length,
      };
    } else {
      // SQL targets (postgres, mysql, sqlite)
      const result = await convertJsonToSql(JSON.stringify(jsonData), targetType);

      // Combine all SQL artifacts into a single schema string
      const schema = Object.values(result.artifacts).join('\n\n');

      // Generate sample INSERT statements for preview
      const sampleInserts = generateSqlInserts(dataArray.slice(0, 5), targetType);

      return {
        success: true,
        schema,
        sampleData: dataArray.slice(0, 5),
        sampleInserts,
        tableCount: Object.keys(result.artifacts).length,
        recordCount: dataArray.length,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate preview',
    };
  }
}

/**
 * Generate SQL INSERT statements from JSON data
 */
function generateSqlInserts(records: any[], dialect: 'postgres' | 'mysql' | 'sqlite'): string[] {
  if (records.length === 0) return [];

  const tableName = 'main_table';
  const inserts: string[] = [];

  for (const record of records) {
    const columns = Object.keys(record).filter(key => !Array.isArray(record[key]) && typeof record[key] !== 'object');
    const values = columns.map(col => {
      const val = record[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      return String(val);
    });

    const columnList = columns.map(c => `"${c}"`).join(', ');
    const valueList = values.join(', ');

    inserts.push(`INSERT INTO "${tableName}" (${columnList}) VALUES (${valueList});`);
  }

  return inserts;
}

/**
 * Execute JSON to database migration - ACTUAL DATA MIGRATION
 */
export async function executeJsonMigration(
  jsonData: any,
  targetConnection: DatabaseConnection,
  progressCallback?: (message: string, progress: number) => void
): Promise<{ success: boolean; message: string; recordsInserted: number; errors?: string[] }> {
  const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
  const errors: string[] = [];
  let connection: any = null;

  try {
    progressCallback?.('Connecting to target database...', 10);

    // Connect to target database
    connection = await getDatabaseConnection(targetConnection);

    if (targetConnection.type === 'mongodb') {
      // MongoDB migration - insert documents directly
      progressCallback?.('Creating MongoDB collection...', 30);

      const db = connection.db(targetConnection.database || 'test');
      const collection = db.collection('main_collection');

      progressCallback?.('Inserting documents...', 50);

      // Insert all documents
      const result = await collection.insertMany(dataArray);

      progressCallback?.('Migration complete!', 100);

      return {
        success: true,
        message: `Successfully inserted ${result.insertedCount} documents into MongoDB`,
        recordsInserted: result.insertedCount,
      };
    } else {
      // SQL migration - execute CREATE and INSERT statements
      progressCallback?.('Generating SQL schema...', 20);

      const dialect = targetConnection.type as 'postgres' | 'mysql' | 'sqlite';
      const result = await convertJsonToSql(JSON.stringify(jsonData), dialect);

      // Extract CREATE TABLE statements from artifacts
      const createStatements = Object.values(result.artifacts);

      progressCallback?.('Creating tables...', 30);

      // Execute CREATE TABLE statements
      if (dialect === 'postgres') {
        // PostgreSQL
        const client = await connection.connect();

        try {
          await client.query('BEGIN');

          // Execute CREATE statements
          for (const createStmt of createStatements) {
            const statements = createStmt.split(';').filter(s => s.trim());
            for (const stmt of statements) {
              if (stmt.trim()) {
                await client.query(stmt);
              }
            }
          }

          progressCallback?.('Inserting data...', 50);

          // Generate and execute INSERT statements
          const inserted = await insertRecordsPostgres(client, dataArray, progressCallback);

          await client.query('COMMIT');
          client.release();

          progressCallback?.('Migration complete!', 100);

          return {
            success: true,
            message: `Successfully migrated ${inserted} records to PostgreSQL`,
            recordsInserted: inserted,
          };
        } catch (error) {
          await client.query('ROLLBACK');
          client.release();
          throw error;
        }
      } else if (dialect === 'mysql') {
        // MySQL
        const mysqlConnection = await connection.getConnection();

        try {
          await mysqlConnection.beginTransaction();

          // Execute CREATE statements
          for (const createStmt of createStatements) {
            const statements = createStmt.split(';').filter(s => s.trim());
            for (const stmt of statements) {
              if (stmt.trim()) {
                await mysqlConnection.query(stmt);
              }
            }
          }

          progressCallback?.('Inserting data...', 50);

          // Generate and execute INSERT statements
          const inserted = await insertRecordsMysql(mysqlConnection, dataArray, progressCallback);

          await mysqlConnection.commit();
          mysqlConnection.release();

          progressCallback?.('Migration complete!', 100);

          return {
            success: true,
            message: `Successfully migrated ${inserted} records to MySQL`,
            recordsInserted: inserted,
          };
        } catch (error) {
          await mysqlConnection.rollback();
          mysqlConnection.release();
          throw error;
        }
      } else {
        // SQLite
        try {
          connection.exec('BEGIN TRANSACTION');

          // Execute CREATE statements
          for (const createStmt of createStatements) {
            const statements = createStmt.split(';').filter(s => s.trim());
            for (const stmt of statements) {
              if (stmt.trim()) {
                connection.exec(stmt);
              }
            }
          }

          progressCallback?.('Inserting data...', 50);

          // Generate and execute INSERT statements
          const inserted = await insertRecordsSqlite(connection, dataArray, progressCallback);

          connection.exec('COMMIT');

          progressCallback?.('Migration complete!', 100);

          return {
            success: true,
            message: `Successfully migrated ${inserted} records to SQLite`,
            recordsInserted: inserted,
          };
        } catch (error) {
          connection.exec('ROLLBACK');
          throw error;
        }
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Migration failed';
    errors.push(errorMsg);

    return {
      success: false,
      message: errorMsg,
      recordsInserted: 0,
      errors,
    };
  } finally {
    // Close connection
    if (connection) {
      try {
        await closeDatabaseConnection(targetConnection.type, connection);
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

/**
 * Insert records into PostgreSQL
 */
async function insertRecordsPostgres(
  client: any,
  records: any[],
  progressCallback?: (message: string, progress: number) => void
): Promise<number> {
  let inserted = 0;
  const tableName = 'main_table';

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const columns = Object.keys(record).filter(key => !Array.isArray(record[key]) && typeof record[key] !== 'object');

    if (columns.length === 0) continue;

    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
    const columnList = columns.map(c => `"${c}"`).join(', ');
    const values = columns.map(col => record[col]);

    const insertSql = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;

    await client.query(insertSql, values);
    inserted++;

    // Update progress
    const progress = 50 + Math.floor((i / records.length) * 50);
    progressCallback?.(`Inserted ${inserted}/${records.length} records`, progress);
  }

  return inserted;
}

/**
 * Insert records into MySQL
 */
async function insertRecordsMysql(
  connection: any,
  records: any[],
  progressCallback?: (message: string, progress: number) => void
): Promise<number> {
  let inserted = 0;
  const tableName = 'main_table';

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const columns = Object.keys(record).filter(key => !Array.isArray(record[key]) && typeof record[key] !== 'object');

    if (columns.length === 0) continue;

    const placeholders = columns.map(() => '?').join(', ');
    const columnList = columns.map(c => `\`${c}\``).join(', ');
    const values = columns.map(col => record[col]);

    const insertSql = `INSERT INTO \`${tableName}\` (${columnList}) VALUES (${placeholders})`;

    await connection.query(insertSql, values);
    inserted++;

    // Update progress
    const progress = 50 + Math.floor((i / records.length) * 50);
    progressCallback?.(`Inserted ${inserted}/${records.length} records`, progress);
  }

  return inserted;
}

/**
 * Insert records into SQLite
 */
async function insertRecordsSqlite(
  db: any,
  records: any[],
  progressCallback?: (message: string, progress: number) => void
): Promise<number> {
  let inserted = 0;
  const tableName = 'main_table';

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const columns = Object.keys(record).filter(key => !Array.isArray(record[key]) && typeof record[key] !== 'object');

    if (columns.length === 0) continue;

    const placeholders = columns.map(() => '?').join(', ');
    const columnList = columns.map(c => `"${c}"`).join(', ');
    const values = columns.map(col => record[col]);

    const insertSql = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;

    const stmt = db.prepare(insertSql);
    stmt.run(...values);
    inserted++;

    // Update progress
    const progress = 50 + Math.floor((i / records.length) * 50);
    progressCallback?.(`Inserted ${inserted}/${records.length} records`, progress);
  }

  return inserted;
}
