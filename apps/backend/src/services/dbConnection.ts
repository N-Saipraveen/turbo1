import pg from 'pg';
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import { MongoClient } from 'mongodb';

const { Pool: PgPool } = pg;

export type DatabaseType = 'postgres' | 'mysql' | 'sqlite' | 'mongodb';

export interface DatabaseConnection {
  type: DatabaseType;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  filePath?: string; // For SQLite
  uri?: string; // For MongoDB
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  version?: string;
  databases?: string[];
}

export async function testDatabaseConnection(
  connection: DatabaseConnection
): Promise<ConnectionTestResult> {
  try {
    switch (connection.type) {
      case 'postgres':
        return await testPostgresConnection(connection);
      case 'mysql':
        return await testMysqlConnection(connection);
      case 'sqlite':
        return await testSqliteConnection(connection);
      case 'mongodb':
        return await testMongoConnection(connection);
      default:
        return {
          success: false,
          message: `Unsupported database type: ${connection.type}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function testPostgresConnection(
  connection: DatabaseConnection
): Promise<ConnectionTestResult> {
  const pool = new PgPool({
    host: connection.host,
    port: connection.port || 5432,
    database: connection.database || 'postgres',
    user: connection.username,
    password: connection.password,
    max: 1,
    connectionTimeoutMillis: 5000,
    // Always enforce SSL for security (required for cloud providers like Aiven)
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    const version = result.rows[0].version;

    // Get list of databases
    const dbResult = await client.query(
      'SELECT datname FROM pg_database WHERE datistemplate = false'
    );
    const databases = dbResult.rows.map((row: any) => row.datname);

    client.release();
    await pool.end();

    return {
      success: true,
      message: 'Connection successful',
      version,
      databases,
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}

async function testMysqlConnection(
  connection: DatabaseConnection
): Promise<ConnectionTestResult> {
  const conn = await mysql.createConnection({
    host: connection.host,
    port: connection.port || 3306,
    user: connection.username,
    password: connection.password,
    database: connection.database,
    connectTimeout: 5000,
    // Always enforce SSL for security (required for cloud providers like Aiven)
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    const [rows]: any = await conn.query('SELECT VERSION() as version');
    const version = rows[0].version;

    // Get list of databases
    const [databases]: any = await conn.query('SHOW DATABASES');
    const databaseList = databases.map((row: any) => row.Database);

    await conn.end();

    return {
      success: true,
      message: 'Connection successful',
      version,
      databases: databaseList,
    };
  } catch (error) {
    await conn.end();
    throw error;
  }
}

async function testSqliteConnection(
  connection: DatabaseConnection
): Promise<ConnectionTestResult> {
  if (!connection.filePath) {
    throw new Error('SQLite file path is required');
  }

  try {
    const db = new Database(connection.filePath);
    const version = db.prepare('SELECT sqlite_version() as version').get() as any;

    // Get list of tables
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as any[];

    db.close();

    return {
      success: true,
      message: 'Connection successful',
      version: version.version,
      databases: tables.map((t) => t.name),
    };
  } catch (error) {
    throw error;
  }
}

async function testMongoConnection(
  connection: DatabaseConnection
): Promise<ConnectionTestResult> {
  if (!connection.uri) {
    throw new Error('MongoDB URI is required');
  }

  const client = new MongoClient(connection.uri, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    const admin = client.db().admin();
    const info = await admin.serverInfo();

    // Get list of databases
    const dbList = await admin.listDatabases();
    const databases = dbList.databases.map((db: any) => db.name);

    await client.close();

    return {
      success: true,
      message: 'Connection successful',
      version: info.version,
      databases,
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}

export async function getDatabaseConnection(connection: DatabaseConnection): Promise<any> {
  switch (connection.type) {
    case 'postgres': {
      const pool = new PgPool({
        host: connection.host,
        port: connection.port || 5432,
        database: connection.database,
        user: connection.username,
        password: connection.password,
        // Always enforce SSL for security (required for cloud providers like Aiven)
        ssl: {
          rejectUnauthorized: false,
        },
      });
      return pool;
    }
    case 'mysql': {
      const pool = mysql.createPool({
        host: connection.host,
        port: connection.port || 3306,
        user: connection.username,
        password: connection.password,
        database: connection.database,
        waitForConnections: true,
        connectionLimit: 10,
        // Always enforce SSL for security (required for cloud providers like Aiven)
        ssl: {
          rejectUnauthorized: false,
        },
      });
      return pool;
    }
    case 'sqlite': {
      if (!connection.filePath) {
        throw new Error('SQLite file path is required');
      }
      return new Database(connection.filePath);
    }
    case 'mongodb': {
      if (!connection.uri) {
        throw new Error('MongoDB URI is required');
      }
      const client = new MongoClient(connection.uri);
      await client.connect();
      return client;
    }
    default:
      throw new Error(`Unsupported database type: ${connection.type}`);
  }
}

export async function closeDatabaseConnection(type: DatabaseType, connection: any): Promise<void> {
  try {
    switch (type) {
      case 'postgres':
        await connection.end();
        break;
      case 'mysql':
        await connection.end();
        break;
      case 'sqlite':
        connection.close();
        break;
      case 'mongodb':
        await connection.close();
        break;
    }
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
}
