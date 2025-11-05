import { DatabaseConnection, getDatabaseConnection, closeDatabaseConnection } from './dbConnection.js';

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKeys: string[];
  foreignKeys: ForeignKeySchema[];
  indexes: IndexSchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  maxLength?: number;
}

export interface ForeignKeySchema {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
}

export async function introspectDatabaseSchema(
  connection: DatabaseConnection
): Promise<TableSchema[]> {
  const db = await getDatabaseConnection(connection);

  try {
    switch (connection.type) {
      case 'postgres':
        return await introspectPostgresSchema(db, connection.database!);
      case 'mysql':
        return await introspectMysqlSchema(db, connection.database!);
      case 'sqlite':
        return await introspectSqliteSchema(db);
      case 'mongodb':
        return await introspectMongoSchema(db, connection.database!);
      default:
        throw new Error(`Unsupported database type: ${connection.type}`);
    }
  } finally {
    await closeDatabaseConnection(connection.type, db);
  }
}

async function introspectPostgresSchema(
  pool: any,
  _database: string
): Promise<TableSchema[]> {
  const client = await pool.connect();

  try {
    // Get tables
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables: TableSchema[] = [];

    for (const row of tablesResult.rows) {
      const tableName = row.table_name;

      // Get columns
      const columnsResult = await client.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      const columns: ColumnSchema[] = columnsResult.rows.map((col: any) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        defaultValue: col.column_default,
        maxLength: col.character_maximum_length,
      }));

      // Get primary keys
      const pkResult = await client.query(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass
          AND i.indisprimary
      `, [tableName]);

      const primaryKeys = pkResult.rows.map((row: any) => row.attname);

      // Get foreign keys
      const fkResult = await client.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
      `, [tableName]);

      const foreignKeys: ForeignKeySchema[] = fkResult.rows.map((row: any) => ({
        column: row.column_name,
        referencedTable: row.referenced_table,
        referencedColumn: row.referenced_column,
      }));

      // Get indexes
      const idxResult = await client.query(`
        SELECT
          i.relname AS index_name,
          a.attname AS column_name,
          ix.indisunique AS is_unique
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relname = $1
          AND NOT ix.indisprimary
        ORDER BY i.relname, a.attnum
      `, [tableName]);

      const indexMap = new Map<string, { columns: string[]; unique: boolean }>();
      for (const row of idxResult.rows) {
        const name = row.index_name;
        if (!indexMap.has(name)) {
          indexMap.set(name, { columns: [], unique: row.is_unique });
        }
        indexMap.get(name)!.columns.push(row.column_name);
      }

      const indexes: IndexSchema[] = Array.from(indexMap.entries()).map(([name, data]) => ({
        name,
        columns: data.columns,
        unique: data.unique,
      }));

      tables.push({
        name: tableName,
        columns,
        primaryKeys,
        foreignKeys,
        indexes,
      });
    }

    return tables;
  } finally {
    client.release();
  }
}

async function introspectMysqlSchema(
  pool: any,
  database: string
): Promise<TableSchema[]> {
  const connection = await pool.getConnection();

  try {
    const [tables]: any = await connection.query(
      'SHOW TABLES FROM ??',
      [database]
    );

    const tableSchemas: TableSchema[] = [];

    for (const tableRow of tables) {
      const tableName = Object.values(tableRow)[0] as string;

      // Get columns
      const [columns]: any = await connection.query(
        'SHOW FULL COLUMNS FROM ?? IN ??',
        [tableName, database]
      );

      const columnSchemas: ColumnSchema[] = columns.map((col: any) => ({
        name: col.Field,
        type: col.Type,
        nullable: col.Null === 'YES',
        defaultValue: col.Default,
      }));

      // Get primary keys
      const [keys]: any = await connection.query(
        'SHOW KEYS FROM ?? IN ?? WHERE Key_name = "PRIMARY"',
        [tableName, database]
      );

      const primaryKeys = keys.map((key: any) => key.Column_name);

      // Get foreign keys
      const [fks]: any = await connection.query(`
        SELECT
          COLUMN_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [database, tableName]);

      const foreignKeys: ForeignKeySchema[] = fks.map((fk: any) => ({
        column: fk.COLUMN_NAME,
        referencedTable: fk.REFERENCED_TABLE_NAME,
        referencedColumn: fk.REFERENCED_COLUMN_NAME,
      }));

      // Get indexes
      const [indexes]: any = await connection.query(
        'SHOW INDEX FROM ?? IN ??',
        [tableName, database]
      );

      const indexMap = new Map<string, { columns: string[]; unique: boolean }>();
      for (const idx of indexes) {
        if (idx.Key_name === 'PRIMARY') continue;
        if (!indexMap.has(idx.Key_name)) {
          indexMap.set(idx.Key_name, { columns: [], unique: idx.Non_unique === 0 });
        }
        indexMap.get(idx.Key_name)!.columns.push(idx.Column_name);
      }

      const indexSchemas: IndexSchema[] = Array.from(indexMap.entries()).map(([name, data]) => ({
        name,
        columns: data.columns,
        unique: data.unique,
      }));

      tableSchemas.push({
        name: tableName,
        columns: columnSchemas,
        primaryKeys,
        foreignKeys,
        indexes: indexSchemas,
      });
    }

    return tableSchemas;
  } finally {
    connection.release();
  }
}

async function introspectSqliteSchema(db: any): Promise<TableSchema[]> {
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all() as any[];

  const tableSchemas: TableSchema[] = [];

  for (const table of tables) {
    const tableName = table.name;

    // Get columns
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];

    const columnSchemas: ColumnSchema[] = columns.map((col: any) => ({
      name: col.name,
      type: col.type,
      nullable: col.notnull === 0,
      defaultValue: col.dflt_value,
    }));

    // Get primary keys
    const primaryKeys = columns
      .filter((col: any) => col.pk > 0)
      .map((col: any) => col.name);

    // Get foreign keys
    const fks = db.prepare(`PRAGMA foreign_key_list(${tableName})`).all() as any[];

    const foreignKeys: ForeignKeySchema[] = fks.map((fk: any) => ({
      column: fk.from,
      referencedTable: fk.table,
      referencedColumn: fk.to,
    }));

    // Get indexes
    const indexes = db.prepare(`PRAGMA index_list(${tableName})`).all() as any[];

    const indexSchemas: IndexSchema[] = [];
    for (const idx of indexes) {
      const idxInfo = db.prepare(`PRAGMA index_info(${idx.name})`).all() as any[];
      indexSchemas.push({
        name: idx.name,
        columns: idxInfo.map((info: any) => info.name),
        unique: idx.unique === 1,
      });
    }

    tableSchemas.push({
      name: tableName,
      columns: columnSchemas,
      primaryKeys,
      foreignKeys,
      indexes: indexSchemas,
    });
  }

  return tableSchemas;
}

async function introspectMongoSchema(
  client: any,
  database: string
): Promise<TableSchema[]> {
  const db = client.db(database);
  const collections = await db.listCollections().toArray();

  const tableSchemas: TableSchema[] = [];

  for (const coll of collections) {
    const collectionName = coll.name;

    // Sample documents to infer schema
    const sampleDocs = await db.collection(collectionName).find().limit(100).toArray();

    if (sampleDocs.length === 0) {
      tableSchemas.push({
        name: collectionName,
        columns: [],
        primaryKeys: ['_id'],
        foreignKeys: [],
        indexes: [],
      });
      continue;
    }

    // Infer columns from documents
    const fieldSet = new Set<string>();
    const fieldTypes = new Map<string, string>();

    for (const doc of sampleDocs) {
      for (const [key, value] of Object.entries(doc)) {
        fieldSet.add(key);
        if (!fieldTypes.has(key)) {
          fieldTypes.set(key, inferMongoType(value));
        }
      }
    }

    const columns: ColumnSchema[] = Array.from(fieldSet).map((field) => ({
      name: field,
      type: fieldTypes.get(field) || 'mixed',
      nullable: true,
    }));

    // Get indexes
    const indexInfo = await db.collection(collectionName).indexes();
    const indexes: IndexSchema[] = indexInfo
      .filter((idx: any) => idx.name !== '_id_')
      .map((idx: any) => ({
        name: idx.name,
        columns: Object.keys(idx.key),
        unique: idx.unique || false,
      }));

    tableSchemas.push({
      name: collectionName,
      columns,
      primaryKeys: ['_id'],
      foreignKeys: [],
      indexes,
    });
  }

  return tableSchemas;
}

function inferMongoType(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';

  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return Number.isInteger(value) ? 'int' : 'double';
    case 'boolean':
      return 'bool';
    case 'object':
      return 'object';
    default:
      return 'mixed';
  }
}
