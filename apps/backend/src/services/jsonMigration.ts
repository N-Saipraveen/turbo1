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

      // Analyze the data structure to understand relationships
      const { mainTableData, childTables, relatedTables } = analyzeDataStructure(dataArray);

      // Initialize progress tracking
      const progressMap = new Map<string, MigrationProgress>();
      progressMap.set('main_table', {
        table: 'main_table',
        current: 0,
        total: mainTableData.length,
        percentage: 0,
        status: 'pending',
      });

      for (const [tableName, data] of Object.entries(childTables)) {
        progressMap.set(tableName, {
          table: tableName,
          current: 0,
          total: data.length,
          percentage: 0,
          status: 'pending',
        });
      }

      for (const [tableName, data] of Object.entries(relatedTables)) {
        progressMap.set(tableName, {
          table: tableName,
          current: 0,
          total: data.length,
          percentage: 0,
          status: 'pending',
        });
      }

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

          // Insert main table data
          progressMap.get('main_table')!.status = 'in_progress';
          updateProgress();

          const mainInserted = await insertRecordsPostgres(
            client,
            mainTableData,
            'main_table',
            (current) => {
              const progress = progressMap.get('main_table')!;
              progress.current = current;
              progress.percentage = Math.floor((current / progress.total) * 100);
              updateProgress();
            }
          );

          progressMap.get('main_table')!.status = 'completed';
          tableDetails.push({ table: 'main_table', rows: mainInserted });
          totalRecordsInserted += mainInserted;
          updateProgress();

          // Insert child table data (arrays)
          for (const [tableName, records] of Object.entries(childTables)) {
            if (progressMap.has(tableName)) {
              progressMap.get(tableName)!.status = 'in_progress';
              updateProgress();

              const inserted = await insertRecordsPostgres(
                client,
                records,
                tableName,
                (current) => {
                  const progress = progressMap.get(tableName)!;
                  progress.current = current;
                  progress.percentage = Math.floor((current / progress.total) * 100);
                  updateProgress();
                }
              );

              progressMap.get(tableName)!.status = 'completed';
              tableDetails.push({ table: tableName, rows: inserted });
              totalRecordsInserted += inserted;
              updateProgress();
            }
          }

          // Insert related table data (nested objects)
          for (const [tableName, records] of Object.entries(relatedTables)) {
            if (progressMap.has(tableName)) {
              progressMap.get(tableName)!.status = 'in_progress';
              updateProgress();

              const inserted = await insertRecordsPostgres(
                client,
                records,
                tableName,
                (current) => {
                  const progress = progressMap.get(tableName)!;
                  progress.current = current;
                  progress.percentage = Math.floor((current / progress.total) * 100);
                  updateProgress();
                }
              );

              progressMap.get(tableName)!.status = 'completed';
              tableDetails.push({ table: tableName, rows: inserted });
              totalRecordsInserted += inserted;
              updateProgress();
            }
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

          // Insert main table data
          progressMap.get('main_table')!.status = 'in_progress';
          updateProgress();

          const mainInserted = await insertRecordsMysql(
            mysqlConnection,
            mainTableData,
            'main_table',
            (current) => {
              const progress = progressMap.get('main_table')!;
              progress.current = current;
              progress.percentage = Math.floor((current / progress.total) * 100);
              updateProgress();
            }
          );

          progressMap.get('main_table')!.status = 'completed';
          tableDetails.push({ table: 'main_table', rows: mainInserted });
          totalRecordsInserted += mainInserted;
          updateProgress();

          // Insert child and related tables
          for (const [tableName, records] of Object.entries({...childTables, ...relatedTables})) {
            if (progressMap.has(tableName)) {
              progressMap.get(tableName)!.status = 'in_progress';
              updateProgress();

              const inserted = await insertRecordsMysql(
                mysqlConnection,
                records,
                tableName,
                (current) => {
                  const progress = progressMap.get(tableName)!;
                  progress.current = current;
                  progress.percentage = Math.floor((current / progress.total) * 100);
                  updateProgress();
                }
              );

              progressMap.get(tableName)!.status = 'completed';
              tableDetails.push({ table: tableName, rows: inserted });
              totalRecordsInserted += inserted;
              updateProgress();
            }
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

          // Insert main table data
          progressMap.get('main_table')!.status = 'in_progress';
          updateProgress();

          const mainInserted = await insertRecordsSqlite(
            connection,
            mainTableData,
            'main_table',
            (current) => {
              const progress = progressMap.get('main_table')!;
              progress.current = current;
              progress.percentage = Math.floor((current / progress.total) * 100);
              updateProgress();
            }
          );

          progressMap.get('main_table')!.status = 'completed';
          tableDetails.push({ table: 'main_table', rows: mainInserted });
          totalRecordsInserted += mainInserted;
          updateProgress();

          // Insert child and related tables
          for (const [tableName, records] of Object.entries({...childTables, ...relatedTables})) {
            if (progressMap.has(tableName)) {
              progressMap.get(tableName)!.status = 'in_progress';
              updateProgress();

              const inserted = await insertRecordsSqlite(
                connection,
                records,
                tableName,
                (current) => {
                  const progress = progressMap.get(tableName)!;
                  progress.current = current;
                  progress.percentage = Math.floor((current / progress.total) * 100);
                  updateProgress();
                }
              );

              progressMap.get(tableName)!.status = 'completed';
              tableDetails.push({ table: tableName, rows: inserted });
              totalRecordsInserted += inserted;
              updateProgress();
            }
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
 * Analyze data structure and extract data for each table
 */
function analyzeDataStructure(records: any[]): {
  mainTableData: any[];
  childTables: Record<string, any[]>;
  relatedTables: Record<string, any[]>;
} {
  const mainTableData: any[] = [];
  const childTables: Record<string, any[]> = {};
  const relatedTables: Record<string, any[]> = {};

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const mainRecord: any = {};

    // Get the primary key value from the record (usually 'id')
    const pkValue = record.id !== undefined ? record.id : (i + 1);

    for (const key in record) {
      const value = record[key];

      if (Array.isArray(value)) {
        // Array field - becomes child table
        const childTableName = `main_table_${key}`;

        if (!childTables[childTableName]) {
          childTables[childTableName] = [];
        }

        // Each array element becomes a row with FK to parent
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            // For arrays of objects, use main_table_id (matches createChildTable schema)
            childTables[childTableName].push({
              main_table_id: pkValue,
              ...item,
            });
          } else {
            // For arrays of primitives, use parent_id (matches createPrimitiveArrayTable schema)
            childTables[childTableName].push({
              parent_id: pkValue,
              value: item,
            });
          }
        }
      } else if (value && typeof value === 'object') {
        // Nested object - becomes related table with FK to parent
        const relatedTableName = `main_table_${key}`;

        if (!relatedTables[relatedTableName]) {
          relatedTables[relatedTableName] = [];
        }

        relatedTables[relatedTableName].push({
          main_table_id: pkValue, // FK to parent table
          ...value,
        });
      } else {
        // Scalar value - stays in main table
        mainRecord[key] = value;
      }
    }

    mainTableData.push(mainRecord);
  }

  return { mainTableData, childTables, relatedTables };
}

/**
 * Insert records into PostgreSQL
 */
async function insertRecordsPostgres(
  client: any,
  records: any[],
  tableName: string,
  progressCallback?: (current: number) => void
): Promise<number> {
  let inserted = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const columns = Object.keys(record);

    if (columns.length === 0) continue;

    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
    const columnList = columns.map(c => `"${c}"`).join(', ');
    const values = columns.map(col => record[col]);

    const insertSql = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;

    await client.query(insertSql, values);
    inserted++;
    progressCallback?.(inserted);
  }

  return inserted;
}

/**
 * Insert records into MySQL
 */
async function insertRecordsMysql(
  connection: any,
  records: any[],
  tableName: string,
  progressCallback?: (current: number) => void
): Promise<number> {
  let inserted = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const columns = Object.keys(record);

    if (columns.length === 0) continue;

    const placeholders = columns.map(() => '?').join(', ');
    const columnList = columns.map(c => `\`${c}\``).join(', ');
    const values = columns.map(col => record[col]);

    const insertSql = `INSERT INTO \`${tableName}\` (${columnList}) VALUES (${placeholders})`;

    await connection.query(insertSql, values);
    inserted++;
    progressCallback?.(inserted);
  }

  return inserted;
}

/**
 * Insert records into SQLite
 */
async function insertRecordsSqlite(
  db: any,
  records: any[],
  tableName: string,
  progressCallback?: (current: number) => void
): Promise<number> {
  let inserted = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const columns = Object.keys(record);

    if (columns.length === 0) continue;

    const placeholders = columns.map(() => '?').join(', ');
    const columnList = columns.map(c => `"${c}"`).join(', ');
    const values = columns.map(col => record[col]);

    const insertSql = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;

    const stmt = db.prepare(insertSql);
    stmt.run(...values);
    inserted++;
    progressCallback?.(inserted);
  }

  return inserted;
}
