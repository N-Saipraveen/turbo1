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
  tableSummary?: Array<{ table: string; estimatedRows: number }>;
  error?: string;
}

export interface MigrationProgress {
  table: string;
  current: number;
  total: number;
  percentage: number;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
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
      const sampleInserts = dataArray.slice(0, 5).map((record) =>
        `db.collection.insertOne(${JSON.stringify(record, null, 2)})`
      );

      return {
        success: true,
        schema,
        sampleData: dataArray.slice(0, 5),
        sampleInserts,
        tableCount: 1,
        recordCount: dataArray.length,
        tableSummary: [{ table: 'main_collection', estimatedRows: dataArray.length }],
      };
    } else {
      // SQL targets (postgres, mysql, sqlite)
      const result = await convertJsonToSql(JSON.stringify(jsonData), targetType);

      // Combine all SQL artifacts into a single schema string
      const schema = Object.values(result.artifacts).join('\n\n');

      // Estimate rows per table
      const tableSummary = estimateRowsPerTable(dataArray);

      // Generate sample INSERT statements for preview
      const sampleInserts = generateSqlInserts(dataArray.slice(0, 5), targetType);

      return {
        success: true,
        schema,
        sampleData: dataArray.slice(0, 5),
        sampleInserts,
        tableCount: Object.keys(result.artifacts).length,
        recordCount: dataArray.length,
        tableSummary,
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
 * Estimate how many rows will be in each table after normalization
 */
function estimateRowsPerTable(records: any[]): Array<{ table: string; estimatedRows: number }> {
  const summary: Array<{ table: string; estimatedRows: number }> = [];

  if (records.length === 0) return summary;

  // Main table
  summary.push({ table: 'main_table', estimatedRows: records.length });

  // Analyze first record for nested structures
  const sample = records[0];

  for (const key in sample) {
    const value = sample[key];

    // Array fields become child tables
    if (Array.isArray(value)) {
      const avgArrayLength = records.reduce((sum, r) => {
        return sum + (Array.isArray(r[key]) ? r[key].length : 0);
      }, 0) / records.length;

      const estimatedRows = Math.ceil(avgArrayLength * records.length);
      summary.push({
        table: `main_table_${key}`,
        estimatedRows,
      });
    }
    // Nested objects become related tables
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      summary.push({
        table: `main_table_${key}`,
        estimatedRows: records.length,
      });
    }
  }

  return summary;
}

/**
 * Generate SQL INSERT statements from JSON data
 */
function generateSqlInserts(records: any[], _dialect: 'postgres' | 'mysql' | 'sqlite'): string[] {
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
 * Execute JSON to database migration - COMPLETE DATA MIGRATION WITH NESTED STRUCTURES
 */
export async function executeJsonMigration(
  jsonData: any,
  targetConnection: DatabaseConnection,
  progressCallback?: (progress: MigrationProgress[]) => void
): Promise<{
  success: boolean;
  message: string;
  recordsInserted: number;
  tableDetails: Array<{ table: string; rows: number }>;
  errors?: string[]
}> {
  const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
  const errors: string[] = [];
  let connection: any = null;
  const tableDetails: Array<{ table: string; rows: number }> = [];
  let totalRecordsInserted = 0;

  try {
    // Connect to target database
    connection = await getDatabaseConnection(targetConnection);

    if (targetConnection.type === 'mongodb') {
      // MongoDB migration - insert documents directly (preserves nested structure)
      const db = connection.db(targetConnection.database || 'test');
      const collection = db.collection('main_collection');

      const progress: MigrationProgress[] = [{
        table: 'main_collection',
        current: 0,
        total: dataArray.length,
        percentage: 0,
        status: 'in_progress',
      }];
      progressCallback?.(progress);

      // Insert all documents (MongoDB preserves nested objects and arrays naturally)
      const result = await collection.insertMany(dataArray);

      progress[0].current = result.insertedCount;
      progress[0].percentage = 100;
      progress[0].status = 'completed';
      progressCallback?.(progress);

      return {
        success: true,
        message: `Successfully inserted ${result.insertedCount} documents into MongoDB`,
        recordsInserted: result.insertedCount,
        tableDetails: [{ table: 'main_collection', rows: result.insertedCount }],
      };
    } else {
      // SQL migration - handle normalized schema with child/related tables
      const dialect = targetConnection.type as 'postgres' | 'mysql' | 'sqlite';
      const result = await convertJsonToSql(JSON.stringify(jsonData), dialect);

      // Extract CREATE TABLE statements from artifacts
      const createStatements = Object.values(result.artifacts);

      // Initialize progress tracking (tables discovered dynamically during migration)
      const progressMap = new Map<string, MigrationProgress>();
      progressMap.set('main_table', {
        table: 'main_table',
        current: 0,
        total: dataArray.length,
        percentage: 0,
        status: 'pending',
      });

      const updateProgress = () => {
        progressCallback?.(Array.from(progressMap.values()));
      };

      // Execute CREATE TABLE statements
      if (dialect === 'postgres') {
        const client = await connection.connect();

        try {
          await client.query('BEGIN');

          // Create tables
          for (const createStmt of createStatements) {
            const statements = createStmt.split(';').filter(s => s.trim());
            for (const stmt of statements) {
              if (stmt.trim()) {
                await client.query(stmt);
              }
            }
          }

          // Process each record with parent-first, then children pattern
          for (let i = 0; i < dataArray.length; i++) {
            const record = dataArray[i];

            // Update progress
            progressMap.get('main_table')!.status = 'in_progress';
            progressMap.get('main_table')!.current = i + 1;
            progressMap.get('main_table')!.percentage = Math.floor(((i + 1) / dataArray.length) * 100);
            updateProgress();

            // 1. Insert parent record FIRST
            const mainRecord: any = {};
            const childRecords: Record<string, any[]> = {};
            const relatedRecords: Record<string, any> = {};

            // Separate fields into parent, children, and related
            for (const key in record) {
              const value = record[key];

              if (Array.isArray(value)) {
                // Array becomes child table records
                const childTableName = `main_table_${key}`;
                childRecords[childTableName] = value;
              } else if (value && typeof value === 'object') {
                // Nested object becomes related table record
                const relatedTableName = `main_table_${key}`;
                relatedRecords[relatedTableName] = value;
              } else {
                // Scalar value goes in main table
                mainRecord[key] = value;
              }
            }

            // Insert parent and capture the returned ID
            const parentColumns = Object.keys(mainRecord);
            const parentId = await insertParentRecordPostgres(client, 'main_table', parentColumns, parentColumns.map(col => mainRecord[col]));

            // 2. Insert child records (arrays) with captured parent ID
            for (const [childTableName, childArray] of Object.entries(childRecords)) {
              if (!progressMap.has(childTableName)) {
                progressMap.set(childTableName, {
                  table: childTableName,
                  current: 0,
                  total: dataArray.reduce((sum, r) => sum + (Array.isArray(r[childTableName.replace('main_table_', '')]) ? r[childTableName.replace('main_table_', '')].length : 0), 0),
                  percentage: 0,
                  status: 'in_progress',
                });
              }

              progressMap.get(childTableName)!.status = 'in_progress';

              for (const item of childArray) {
                if (typeof item === 'object' && item !== null) {
                  // Array of objects
                  const childColumns = ['main_table_id', ...Object.keys(item)];
                  const childValues = [parentId, ...Object.keys(item).map(k => item[k])];
                  await insertChildRecordPostgres(client, childTableName, childColumns, childValues);
                } else {
                  // Array of primitives
                  await insertChildRecordPostgres(client, childTableName, ['parent_id', 'value'], [parentId, item]);
                }

                const progress = progressMap.get(childTableName)!;
                progress.current++;
                progress.percentage = Math.floor((progress.current / progress.total) * 100);
                updateProgress();
              }
            }

            // 3. Insert related records (nested objects) with captured parent ID
            for (const [relatedTableName, relatedObj] of Object.entries(relatedRecords)) {
              if (!progressMap.has(relatedTableName)) {
                progressMap.set(relatedTableName, {
                  table: relatedTableName,
                  current: 0,
                  total: dataArray.length,
                  percentage: 0,
                  status: 'in_progress',
                });
              }

              progressMap.get(relatedTableName)!.status = 'in_progress';

              const relatedColumns = ['main_table_id', ...Object.keys(relatedObj)];
              const relatedValues = [parentId, ...Object.keys(relatedObj).map(k => relatedObj[k])];
              await insertChildRecordPostgres(client, relatedTableName, relatedColumns, relatedValues);

              const progress = progressMap.get(relatedTableName)!;
              progress.current++;
              progress.percentage = Math.floor((progress.current / progress.total) * 100);
              updateProgress();
            }
          }

          // Mark all tables as completed
          progressMap.get('main_table')!.status = 'completed';
          updateProgress();

          for (const [tableName] of progressMap) {
            if (tableName !== 'main_table') {
              progressMap.get(tableName)!.status = 'completed';
            }
          }
          updateProgress();

          // Calculate table details
          for (const [tableName, progress] of progressMap) {
            tableDetails.push({ table: tableName, rows: progress.current });
            totalRecordsInserted += progress.current;
          }

          await client.query('COMMIT');
          client.release();

          return {
            success: true,
            message: `Successfully migrated ${totalRecordsInserted} total records across ${tableDetails.length} tables to PostgreSQL`,
            recordsInserted: totalRecordsInserted,
            tableDetails,
          };
        } catch (error) {
          await client.query('ROLLBACK');
          client.release();
          throw error;
        }
      } else if (dialect === 'mysql') {
        const mysqlConnection = await connection.getConnection();

        try {
          await mysqlConnection.beginTransaction();

          // Create tables
          for (const createStmt of createStatements) {
            const statements = createStmt.split(';').filter(s => s.trim());
            for (const stmt of statements) {
              if (stmt.trim()) {
                await mysqlConnection.query(stmt);
              }
            }
          }

          // Process each record with parent-first, then children pattern
          for (let i = 0; i < dataArray.length; i++) {
            const record = dataArray[i];

            // Update progress
            progressMap.get('main_table')!.status = 'in_progress';
            progressMap.get('main_table')!.current = i + 1;
            progressMap.get('main_table')!.percentage = Math.floor(((i + 1) / dataArray.length) * 100);
            updateProgress();

            // 1. Insert parent record FIRST
            const mainRecord: any = {};
            const childRecords: Record<string, any[]> = {};
            const relatedRecords: Record<string, any> = {};

            // Separate fields
            for (const key in record) {
              const value = record[key];

              if (Array.isArray(value)) {
                childRecords[`main_table_${key}`] = value;
              } else if (value && typeof value === 'object') {
                relatedRecords[`main_table_${key}`] = value;
              } else {
                mainRecord[key] = value;
              }
            }

            // Insert parent and capture the returned ID using LAST_INSERT_ID()
            const parentColumns = Object.keys(mainRecord);
            const parentId = await insertParentRecordMysql(mysqlConnection, 'main_table', parentColumns, parentColumns.map(col => mainRecord[col]));

            // 2. Insert child records with captured parent ID
            for (const [childTableName, childArray] of Object.entries(childRecords)) {
              if (!progressMap.has(childTableName)) {
                progressMap.set(childTableName, {
                  table: childTableName,
                  current: 0,
                  total: dataArray.reduce((sum, r) => sum + (Array.isArray(r[childTableName.replace('main_table_', '')]) ? r[childTableName.replace('main_table_', '')].length : 0), 0),
                  percentage: 0,
                  status: 'in_progress',
                });
              }

              progressMap.get(childTableName)!.status = 'in_progress';

              for (const item of childArray) {
                if (typeof item === 'object' && item !== null) {
                  const childColumns = ['main_table_id', ...Object.keys(item)];
                  const childValues = [parentId, ...Object.keys(item).map(k => item[k])];
                  await insertChildRecordMysql(mysqlConnection, childTableName, childColumns, childValues);
                } else {
                  await insertChildRecordMysql(mysqlConnection, childTableName, ['parent_id', 'value'], [parentId, item]);
                }

                const progress = progressMap.get(childTableName)!;
                progress.current++;
                progress.percentage = Math.floor((progress.current / progress.total) * 100);
                updateProgress();
              }
            }

            // 3. Insert related records with captured parent ID
            for (const [relatedTableName, relatedObj] of Object.entries(relatedRecords)) {
              if (!progressMap.has(relatedTableName)) {
                progressMap.set(relatedTableName, {
                  table: relatedTableName,
                  current: 0,
                  total: dataArray.length,
                  percentage: 0,
                  status: 'in_progress',
                });
              }

              progressMap.get(relatedTableName)!.status = 'in_progress';

              const relatedColumns = ['main_table_id', ...Object.keys(relatedObj)];
              const relatedValues = [parentId, ...Object.keys(relatedObj).map(k => relatedObj[k])];
              await insertChildRecordMysql(mysqlConnection, relatedTableName, relatedColumns, relatedValues);

              const progress = progressMap.get(relatedTableName)!;
              progress.current++;
              progress.percentage = Math.floor((progress.current / progress.total) * 100);
              updateProgress();
            }
          }

          // Mark all tables as completed
          progressMap.get('main_table')!.status = 'completed';
          for (const [tableName] of progressMap) {
            if (tableName !== 'main_table') {
              progressMap.get(tableName)!.status = 'completed';
            }
          }
          updateProgress();

          // Calculate table details
          for (const [tableName, progress] of progressMap) {
            tableDetails.push({ table: tableName, rows: progress.current });
            totalRecordsInserted += progress.current;
          }

          await mysqlConnection.commit();
          mysqlConnection.release();

          return {
            success: true,
            message: `Successfully migrated ${totalRecordsInserted} total records across ${tableDetails.length} tables to MySQL`,
            recordsInserted: totalRecordsInserted,
            tableDetails,
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

          // Create tables
          for (const createStmt of createStatements) {
            const statements = createStmt.split(';').filter(s => s.trim());
            for (const stmt of statements) {
              if (stmt.trim()) {
                connection.exec(stmt);
              }
            }
          }

          // Process each record with parent-first, then children pattern
          for (let i = 0; i < dataArray.length; i++) {
            const record = dataArray[i];

            // Update progress
            progressMap.get('main_table')!.status = 'in_progress';
            progressMap.get('main_table')!.current = i + 1;
            progressMap.get('main_table')!.percentage = Math.floor(((i + 1) / dataArray.length) * 100);
            updateProgress();

            // 1. Insert parent record FIRST
            const mainRecord: any = {};
            const childRecords: Record<string, any[]> = {};
            const relatedRecords: Record<string, any> = {};

            // Separate fields
            for (const key in record) {
              const value = record[key];

              if (Array.isArray(value)) {
                childRecords[`main_table_${key}`] = value;
              } else if (value && typeof value === 'object') {
                relatedRecords[`main_table_${key}`] = value;
              } else {
                mainRecord[key] = value;
              }
            }

            // Insert parent and capture the returned ID using lastInsertRowid
            const parentColumns = Object.keys(mainRecord);
            const parentId = insertParentRecordSqlite(connection, 'main_table', parentColumns, parentColumns.map(col => mainRecord[col]));

            // 2. Insert child records with captured parent ID
            for (const [childTableName, childArray] of Object.entries(childRecords)) {
              if (!progressMap.has(childTableName)) {
                progressMap.set(childTableName, {
                  table: childTableName,
                  current: 0,
                  total: dataArray.reduce((sum, r) => sum + (Array.isArray(r[childTableName.replace('main_table_', '')]) ? r[childTableName.replace('main_table_', '')].length : 0), 0),
                  percentage: 0,
                  status: 'in_progress',
                });
              }

              progressMap.get(childTableName)!.status = 'in_progress';

              for (const item of childArray) {
                if (typeof item === 'object' && item !== null) {
                  const childColumns = ['main_table_id', ...Object.keys(item)];
                  const childValues = [parentId, ...Object.keys(item).map(k => item[k])];
                  insertChildRecordSqlite(connection, childTableName, childColumns, childValues);
                } else {
                  insertChildRecordSqlite(connection, childTableName, ['parent_id', 'value'], [parentId, item]);
                }

                const progress = progressMap.get(childTableName)!;
                progress.current++;
                progress.percentage = Math.floor((progress.current / progress.total) * 100);
                updateProgress();
              }
            }

            // 3. Insert related records with captured parent ID
            for (const [relatedTableName, relatedObj] of Object.entries(relatedRecords)) {
              if (!progressMap.has(relatedTableName)) {
                progressMap.set(relatedTableName, {
                  table: relatedTableName,
                  current: 0,
                  total: dataArray.length,
                  percentage: 0,
                  status: 'in_progress',
                });
              }

              progressMap.get(relatedTableName)!.status = 'in_progress';

              const relatedColumns = ['main_table_id', ...Object.keys(relatedObj)];
              const relatedValues = [parentId, ...Object.keys(relatedObj).map(k => relatedObj[k])];
              insertChildRecordSqlite(connection, relatedTableName, relatedColumns, relatedValues);

              const progress = progressMap.get(relatedTableName)!;
              progress.current++;
              progress.percentage = Math.floor((progress.current / progress.total) * 100);
              updateProgress();
            }
          }

          // Mark all tables as completed
          progressMap.get('main_table')!.status = 'completed';
          for (const [tableName] of progressMap) {
            if (tableName !== 'main_table') {
              progressMap.get(tableName)!.status = 'completed';
            }
          }
          updateProgress();

          // Calculate table details
          for (const [tableName, progress] of progressMap) {
            tableDetails.push({ table: tableName, rows: progress.current });
            totalRecordsInserted += progress.current;
          }

          connection.exec('COMMIT');

          return {
            success: true,
            message: `Successfully migrated ${totalRecordsInserted} total records across ${tableDetails.length} tables to SQLite`,
            recordsInserted: totalRecordsInserted,
            tableDetails,
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
      tableDetails: [],
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
 * Detect PK field name from column list
 */
function detectPKFromColumns(columns: string[]): string | null {
  const pkCandidates = ['id', '_id', 'uuid', 'ID', 'Id', 'UUID'];
  for (const candidate of pkCandidates) {
    if (columns.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Insert parent record and return the primary key value (PostgreSQL)
 * If record has existing PK, inserts it and returns that value
 * If no PK, uses RETURNING to capture auto-generated ID
 */
async function insertParentRecordPostgres(
  client: any,
  tableName: string,
  columns: string[],
  values: any[]
): Promise<number> {
  if (columns.length === 0) {
    // Insert with default values and return auto-generated id
    const result = await client.query(`INSERT INTO "${tableName}" DEFAULT VALUES RETURNING id`);
    return result.rows[0].id;
  }

  // Check if we're inserting an existing PK
  const pkField = detectPKFromColumns(columns);

  const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
  const columnList = columns.map(c => `"${c}"`).join(', ');
  const returningClause = pkField ? pkField : 'id';
  const insertSql = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders}) RETURNING "${returningClause}"`;

  const result = await client.query(insertSql, values);
  return result.rows[0][pkField || 'id'];
}

/**
 * Insert child record (PostgreSQL)
 */
async function insertChildRecordPostgres(
  client: any,
  tableName: string,
  columns: string[],
  values: any[]
): Promise<void> {
  const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
  const columnList = columns.map(c => `"${c}"`).join(', ');
  const insertSql = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;

  await client.query(insertSql, values);
}

/**
 * Insert parent record and return the primary key value (MySQL)
 * If record has existing PK, inserts it and returns that value
 * If no PK, uses LAST_INSERT_ID() to capture auto-generated ID
 */
async function insertParentRecordMysql(
  connection: any,
  tableName: string,
  columns: string[],
  values: any[]
): Promise<number> {
  if (columns.length === 0) {
    // Insert with default values
    await connection.query(`INSERT INTO \`${tableName}\` () VALUES ()`);
    const [idResult] = await connection.query('SELECT LAST_INSERT_ID() as id');
    return idResult[0].id;
  }

  // Check if we're inserting an existing PK
  const pkField = detectPKFromColumns(columns);

  const placeholders = columns.map(() => '?').join(', ');
  const columnList = columns.map(c => `\`${c}\``).join(', ');
  const insertSql = `INSERT INTO \`${tableName}\` (${columnList}) VALUES (${placeholders})`;

  await connection.query(insertSql, values);

  if (pkField) {
    // Return the PK value we just inserted
    const pkIndex = columns.indexOf(pkField);
    return values[pkIndex];
  } else {
    // Return auto-generated ID
    const [idResult] = await connection.query('SELECT LAST_INSERT_ID() as id');
    return idResult[0].id;
  }
}

/**
 * Insert child record (MySQL)
 */
async function insertChildRecordMysql(
  connection: any,
  tableName: string,
  columns: string[],
  values: any[]
): Promise<void> {
  const placeholders = columns.map(() => '?').join(', ');
  const columnList = columns.map(c => `\`${c}\``).join(', ');
  const insertSql = `INSERT INTO \`${tableName}\` (${columnList}) VALUES (${placeholders})`;

  await connection.query(insertSql, values);
}

/**
 * Insert parent record and return the primary key value (SQLite)
 * If record has existing PK, inserts it and returns that value
 * If no PK, uses lastInsertRowid to capture auto-generated ID
 */
function insertParentRecordSqlite(
  db: any,
  tableName: string,
  columns: string[],
  values: any[]
): number {
  if (columns.length === 0) {
    // Insert with default values
    const stmt = db.prepare(`INSERT INTO "${tableName}" DEFAULT VALUES`);
    stmt.run();
    return db.prepare('SELECT last_insert_rowid() as id').get().id;
  }

  // Check if we're inserting an existing PK
  const pkField = detectPKFromColumns(columns);

  const placeholders = columns.map(() => '?').join(', ');
  const columnList = columns.map(c => `"${c}"`).join(', ');
  const insertSql = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;

  const stmt = db.prepare(insertSql);
  stmt.run(...values);

  if (pkField) {
    // Return the PK value we just inserted
    const pkIndex = columns.indexOf(pkField);
    return values[pkIndex];
  } else {
    // Return auto-generated ID
    return db.prepare('SELECT last_insert_rowid() as id').get().id;
  }
}

/**
 * Insert child record (SQLite)
 */
function insertChildRecordSqlite(
  db: any,
  tableName: string,
  columns: string[],
  values: any[]
): void {
  const placeholders = columns.map(() => '?').join(', ');
  const columnList = columns.map(c => `"${c}"`).join(', ');
  const insertSql = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;

  const stmt = db.prepare(insertSql);
  stmt.run(...values);
}
