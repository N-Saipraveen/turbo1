import { DatabaseConnection, getDatabaseConnection, closeDatabaseConnection } from './dbConnection.js';
import { previewJsonMigration, executeJsonMigration } from './jsonMigration.js';
import { introspectDatabaseSchema, type TableSchema } from './schemaIntrospection.js';
import { convertJsonToSql } from './jsonToSql.js';
import { randomUUID } from 'crypto';

/**
 * Normalizes MongoDB documents for SQL insertion
 * - Converts ObjectId _id to string
 * - Generates UUID if _id is missing
 * - Ensures _id is never null or undefined
 */
function normalizeMongoDocument(doc: any): any {
  const copy = { ...doc };

  // Handle _id field
  if (copy._id) {
    // Check if it's a MongoDB ObjectId (has toString method)
    if (typeof copy._id === 'object' && copy._id.toString) {
      copy._id = copy._id.toString();
    }
    // Check if it's a BSON ObjectId format { $oid: "..." }
    else if (typeof copy._id === 'object' && copy._id.$oid) {
      copy._id = copy._id.$oid;
    }
    // If it's already a string, keep it
    else if (typeof copy._id !== 'string') {
      // Convert to string representation
      copy._id = String(copy._id);
    }
  } else {
    // Auto-generate UUID if _id is missing
    copy._id = randomUUID();
  }

  // Handle nested ObjectIds in other fields
  for (const key in copy) {
    if (key !== '_id' && copy[key] && typeof copy[key] === 'object') {
      // Check if it's an ObjectId
      if (copy[key].toString && !Array.isArray(copy[key])) {
        copy[key] = copy[key].toString();
      }
      // Handle $oid format
      else if (copy[key].$oid) {
        copy[key] = copy[key].$oid;
      }
    }
  }

  return copy;
}

/**
 * Normalizes an array of MongoDB documents
 */
function normalizeMongoDocuments(docs: any[]): any[] {
  return docs.map(doc => normalizeMongoDocument(doc));
}

export interface MigrationPreview {
  success: boolean;
  schema?: string;
  sampleData?: any[];
  sampleInserts?: string[];
  tableCount?: number;
  recordCount?: number;
  tableSummary?: Array<{ table: string; estimatedRows: number }>;
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  message: string;
  recordsInserted: number;
  tableDetails: Array<{ table: string; rows: number }>;
  errors?: string[];
}

/**
 * Preview migration from any source to any target
 */
export async function previewMigration(
  sourceConnection: DatabaseConnection,
  targetType: string
): Promise<MigrationPreview> {
  try {
    // Handle JSON source (use existing logic)
    if (sourceConnection.type === 'json' && sourceConnection.jsonData) {
      return await previewJsonMigration(
        sourceConnection.jsonData,
        targetType as 'postgres' | 'mysql' | 'sqlite' | 'mongodb'
      );
    }

    // For SQL/MongoDB sources, fetch data and generate preview
    const sourceData = await extractSourceData(sourceConnection);

    if (targetType === 'mongodb') {
      return await previewToMongoDB(sourceData, sourceConnection.type);
    } else {
      // Target is SQL
      return await previewToSQL(sourceData, targetType as 'postgres' | 'mysql' | 'sqlite');
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate preview',
    };
  }
}

/**
 * Execute migration from any source to any target
 */
export async function executeMigration(
  sourceConnection: DatabaseConnection,
  targetConnection: DatabaseConnection
): Promise<MigrationResult> {
  try {
    // Handle JSON source (use existing logic)
    if (sourceConnection.type === 'json' && sourceConnection.jsonData) {
      return await executeJsonMigration(sourceConnection.jsonData, targetConnection);
    }

    // Extract all data from source
    const sourceData = await extractSourceData(sourceConnection);

    // Execute migration based on target type
    if (targetConnection.type === 'mongodb') {
      return await migrateToMongoDB(sourceData, sourceConnection.type, targetConnection);
    } else if (targetConnection.type === 'json') {
      return await migrateToJSON(sourceData, sourceConnection.type, targetConnection);
    } else {
      // Target is SQL
      return await migrateToSQL(sourceData, sourceConnection.type, targetConnection);
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Migration failed',
      recordsInserted: 0,
      tableDetails: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Extract data from source database
 */
async function extractSourceData(sourceConnection: DatabaseConnection): Promise<{
  tables: Array<{ name: string; rows: any[]; schema?: TableSchema }>;
  totalRecords: number;
}> {
  const connection = await getDatabaseConnection(sourceConnection);
  const tables: Array<{ name: string; rows: any[]; schema?: TableSchema }> = [];
  let totalRecords = 0;

  try {
    if (sourceConnection.type === 'mongodb') {
      // Extract from MongoDB
      if (!sourceConnection.database) {
        throw new Error('MongoDB database name is required. Please provide the database name in the connection settings.');
      }

      const db = connection.db(sourceConnection.database);
      const collections = await db.listCollections().toArray();

      for (const coll of collections) {
        const collection = db.collection(coll.name);
        const rows = await collection.find({}).toArray();
        tables.push({ name: coll.name, rows });
        totalRecords += rows.length;
      }
    } else {
      // Extract from SQL databases
      const schema = await introspectDatabaseSchema(sourceConnection);

      for (const table of schema) {
        const rows = await fetchTableData(connection, sourceConnection.type, table.name);
        tables.push({ name: table.name, rows, schema: table });
        totalRecords += rows.length;
      }
    }

    return { tables, totalRecords };
  } finally {
    await closeDatabaseConnection(sourceConnection.type, connection);
  }
}

/**
 * Fetch all data from a SQL table
 */
async function fetchTableData(connection: any, dbType: string, tableName: string): Promise<any[]> {
  if (dbType === 'postgres') {
    const client = await connection.connect();
    try {
      const result = await client.query(`SELECT * FROM "${tableName}"`);
      return result.rows;
    } finally {
      client.release();
    }
  } else if (dbType === 'mysql') {
    const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
    return rows as any[];
  } else if (dbType === 'sqlite') {
    return connection.prepare(`SELECT * FROM "${tableName}"`).all();
  }

  return [];
}

/**
 * Preview migration to MongoDB
 */
async function previewToMongoDB(
  sourceData: { tables: Array<{ name: string; rows: any[] }>; totalRecords: number },
  _sourceType: string
): Promise<MigrationPreview> {
  // Group related tables by foreign keys and create document structure
  const documents = groupTablesIntoDocuments(sourceData.tables);

  const sampleData = documents.slice(0, 5);
  const sampleInserts = sampleData.map((doc) =>
    `db.collection.insertOne(${JSON.stringify(doc, null, 2)})`
  );

  return {
    success: true,
    schema: `// MongoDB Document Structure\n${JSON.stringify(documents[0] || {}, null, 2)}`,
    sampleData,
    sampleInserts,
    tableCount: 1, // MongoDB will use single collection or grouped collections
    recordCount: sourceData.totalRecords,
    tableSummary: sourceData.tables.map(t => ({ table: t.name, estimatedRows: t.rows.length })),
  };
}

/**
 * Preview migration to SQL
 */
async function previewToSQL(
  sourceData: { tables: Array<{ name: string; rows: any[] }>; totalRecords: number },
  targetType: 'postgres' | 'mysql' | 'sqlite'
): Promise<MigrationPreview> {
  // Convert data to JSON, then use existing JSON→SQL converter
  const jsonData = sourceData.tables.length === 1
    ? sourceData.tables[0].rows
    : sourceData.tables.reduce((acc, table) => {
        acc[table.name] = table.rows;
        return acc;
      }, {} as any);

  const result = await convertJsonToSql(JSON.stringify(jsonData), targetType);

  const schema = Object.values(result.artifacts).join('\n\n');
  const sampleRecords = sourceData.tables[0]?.rows.slice(0, 5) || [];

  return {
    success: true,
    schema,
    sampleData: sampleRecords,
    sampleInserts: generateSampleInserts(sampleRecords, sourceData.tables[0]?.name || 'table', targetType),
    tableCount: result.summary.tables,
    recordCount: sourceData.totalRecords,
    tableSummary: sourceData.tables.map(t => ({ table: t.name, estimatedRows: t.rows.length })),
  };
}

/**
 * Generate sample INSERT statements
 */
function generateSampleInserts(records: any[], tableName: string, _dialect: string): string[] {
  return records.slice(0, 5).map(record => {
    const columns = Object.keys(record);
    const values = columns.map(col => {
      const val = record[col];
      if (val === null) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      return String(val);
    });

    const columnList = columns.map(c => `"${c}"`).join(', ');
    const valueList = values.join(', ');

    return `INSERT INTO "${tableName}" (${columnList}) VALUES (${valueList});`;
  });
}

/**
 * Group SQL tables into MongoDB documents based on foreign keys
 */
function groupTablesIntoDocuments(tables: Array<{ name: string; rows: any[]; schema?: TableSchema }>): any[] {
  // Find the main table (table with no foreign keys or most referenced table)
  const mainTable = tables.find(t => !t.schema?.foreignKeys.length) || tables[0];

  if (!mainTable) return [];

  // For each row in main table, embed related data
  return mainTable.rows.map(mainRow => {
    const document: any = { ...mainRow };

    // Find related tables and embed them
    for (const table of tables) {
      if (table.name === mainTable.name) continue;

      const fk = table.schema?.foreignKeys.find(fk => fk.referencedTable === mainTable.name);

      if (fk) {
        // This table references the main table
        const relatedRows = table.rows.filter(row => row[fk.column] === mainRow[fk.referencedColumn]);

        if (relatedRows.length > 0) {
          // Determine if this should be an array or single object
          const fieldName = table.name.replace(`${mainTable.name}_`, '');
          document[fieldName] = relatedRows.length === 1 ? relatedRows[0] : relatedRows;
        }
      }
    }

    return document;
  });
}

/**
 * Migrate to MongoDB
 */
async function migrateToMongoDB(
  sourceData: { tables: Array<{ name: string; rows: any[]; schema?: TableSchema }>; totalRecords: number },
  _sourceType: string,
  targetConnection: DatabaseConnection
): Promise<MigrationResult> {
  const connection = await getDatabaseConnection(targetConnection);
  const tableDetails: Array<{ table: string; rows: number }> = [];
  let totalInserted = 0;

  try {
    const db = connection.db(targetConnection.database || 'migrated_db');

    if (_sourceType === 'mongodb') {
      // MongoDB → MongoDB: Direct collection copy
      for (const table of sourceData.tables) {
        const collection = db.collection(table.name);

        // Drop existing collection to prevent duplicates
        try {
          await collection.drop();
        } catch (err) {
          // Collection might not exist, ignore error
        }

        if (table.rows.length > 0) {
          const result = await collection.insertMany(table.rows);
          const inserted = result.insertedCount;
          tableDetails.push({ table: table.name, rows: inserted });
          totalInserted += inserted;
        }
      }
    } else {
      // SQL → MongoDB: Group by foreign keys
      const documents = groupTablesIntoDocuments(sourceData.tables);
      const mainTableName = sourceData.tables[0]?.name || 'collection';

      const collection = db.collection(mainTableName);

      // Drop existing collection to prevent duplicates
      try {
        await collection.drop();
      } catch (err) {
        // Collection might not exist, ignore error
      }

      if (documents.length > 0) {
        const result = await collection.insertMany(documents);
        totalInserted = result.insertedCount;
        tableDetails.push({ table: mainTableName, rows: totalInserted });
      }
    }

    return {
      success: true,
      message: `Successfully migrated ${totalInserted} records to MongoDB`,
      recordsInserted: totalInserted,
      tableDetails,
    };
  } finally {
    await closeDatabaseConnection(targetConnection.type, connection);
  }
}

/**
 * Migrate to JSON (export)
 */
async function migrateToJSON(
  sourceData: { tables: Array<{ name: string; rows: any[] }>; totalRecords: number },
  _sourceType: string,
  targetConnection: DatabaseConnection
): Promise<MigrationResult> {
  // JSON export - return the data as JSON
  const jsonData = sourceData.tables.length === 1
    ? sourceData.tables[0].rows
    : sourceData.tables.reduce((acc, table) => {
        acc[table.name] = table.rows;
        return acc;
      }, {} as any);

  // Store in targetConnection.jsonData for retrieval
  targetConnection.jsonData = jsonData;

  return {
    success: true,
    message: `Successfully exported ${sourceData.totalRecords} records to JSON`,
    recordsInserted: sourceData.totalRecords,
    tableDetails: sourceData.tables.map(t => ({ table: t.name, rows: t.rows.length })),
  };
}

/**
 * Migrate to SQL
 */
async function migrateToSQL(
  sourceData: { tables: Array<{ name: string; rows: any[] }>; totalRecords: number },
  _sourceType: string,
  targetConnection: DatabaseConnection
): Promise<MigrationResult> {
  // Normalize MongoDB documents if source is MongoDB
  let normalizedData = sourceData;
  if (_sourceType === 'mongodb') {
    normalizedData = {
      ...sourceData,
      tables: sourceData.tables.map(table => ({
        ...table,
        rows: normalizeMongoDocuments(table.rows),
      })),
    };
  }

  // Convert source data to JSON, then use existing JSON→SQL migration
  const jsonData = normalizedData.tables.length === 1
    ? normalizedData.tables[0].rows
    : normalizedData.tables.reduce((acc, table) => {
        acc[table.name] = table.rows;
        return acc;
      }, {} as any);

  return await executeJsonMigration(jsonData, targetConnection);
}
