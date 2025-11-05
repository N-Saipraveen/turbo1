import { getDatabaseConnection, closeDatabaseConnection, type DatabaseConnection } from './dbConnection.js';
import { type TableSchema } from './schemaIntrospection.js';
import { EventEmitter } from 'events';

export interface MigrationConfig {
  source: DatabaseConnection;
  target: DatabaseConnection;
  tables: string[];
  batchSize?: number;
}

export interface MigrationProgress {
  table: string;
  totalRows: number;
  migratedRows: number;
  percentage: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export interface MigrationLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  table?: string;
}

export class MigrationEngine extends EventEmitter {
  private logs: MigrationLog[] = [];
  private progress: Map<string, MigrationProgress> = new Map();

  constructor(private config: MigrationConfig) {
    super();
  }

  private log(level: 'info' | 'warn' | 'error', message: string, table?: string) {
    const log: MigrationLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      table,
    };
    this.logs.push(log);
    this.emit('log', log);
  }

  private updateProgress(table: string, update: Partial<MigrationProgress>) {
    const current = this.progress.get(table) || {
      table,
      totalRows: 0,
      migratedRows: 0,
      percentage: 0,
      status: 'pending',
    };

    const updated = { ...current, ...update };
    if (updated.totalRows > 0) {
      updated.percentage = Math.round((updated.migratedRows / updated.totalRows) * 100);
    }

    this.progress.set(table, updated);
    this.emit('progress', updated);
  }

  async execute(): Promise<{ success: boolean; logs: MigrationLog[]; progress: MigrationProgress[] }> {
    this.log('info', 'Starting migration');
    this.log('info', `Source: ${this.config.source.type} ${this.config.source.database || this.config.source.filePath || 'database'}`);
    this.log('info', `Target: ${this.config.target.type} ${this.config.target.database || this.config.target.filePath || 'database'}`);

    let sourceDb: any = null;
    let targetDb: any = null;

    try {
      // Connect to databases
      this.log('info', 'Connecting to source database...');
      sourceDb = await getDatabaseConnection(this.config.source);

      this.log('info', 'Connecting to target database...');
      targetDb = await getDatabaseConnection(this.config.target);

      // Migrate each table
      for (const table of this.config.tables) {
        await this.migrateTable(sourceDb, targetDb, table);
      }

      this.log('info', 'Migration completed successfully');
      return {
        success: true,
        logs: this.logs,
        progress: Array.from(this.progress.values()),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', `Migration failed: ${errorMessage}`);
      return {
        success: false,
        logs: this.logs,
        progress: Array.from(this.progress.values()),
      };
    } finally {
      if (sourceDb) {
        await closeDatabaseConnection(this.config.source.type, sourceDb);
      }
      if (targetDb) {
        await closeDatabaseConnection(this.config.target.type, targetDb);
      }
    }
  }

  private async migrateTable(sourceDb: any, targetDb: any, table: string): Promise<void> {
    this.log('info', `Starting migration for table: ${table}`, table);
    this.updateProgress(table, { status: 'in_progress' });

    try {
      // Count total rows
      const totalRows = await this.countRows(sourceDb, table);
      this.log('info', `Total rows to migrate: ${totalRows}`, table);
      this.updateProgress(table, { totalRows });

      // Stream and migrate data
      let migratedRows = 0;
      const batchSize = this.config.batchSize || 1000;

      const rows = await this.fetchRows(sourceDb, table, totalRows);

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, Math.min(i + batchSize, rows.length));

        await this.insertBatch(targetDb, table, batch);

        migratedRows += batch.length;
        this.updateProgress(table, { migratedRows });

        this.log('info', `Migrated ${migratedRows}/${totalRows} rows`, table);
      }

      this.updateProgress(table, { status: 'completed', migratedRows: totalRows });
      this.log('info', `Completed migration for table: ${table}`, table);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateProgress(table, { status: 'failed', error: errorMessage });
      this.log('error', `Failed to migrate table ${table}: ${errorMessage}`, table);
      throw error;
    }
  }

  private async countRows(db: any, table: string): Promise<number> {
    switch (this.config.source.type) {
      case 'postgres': {
        const client = await db.connect();
        try {
          const result = await client.query(`SELECT COUNT(*) FROM "${table}"`);
          return parseInt(result.rows[0].count, 10);
        } finally {
          client.release();
        }
      }
      case 'mysql': {
        const [rows]: any = await db.query(`SELECT COUNT(*) as count FROM ??`, [table]);
        return rows[0].count;
      }
      case 'sqlite': {
        const result = db.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get();
        return result.count;
      }
      case 'mongodb': {
        const dbInstance = db.db(this.config.source.database);
        return await dbInstance.collection(table).countDocuments();
      }
      default:
        throw new Error(`Unsupported source type: ${this.config.source.type}`);
    }
  }

  private async fetchRows(db: any, table: string, limit: number): Promise<any[]> {
    switch (this.config.source.type) {
      case 'postgres': {
        const client = await db.connect();
        try {
          const result = await client.query(`SELECT * FROM "${table}" LIMIT ${limit}`);
          return result.rows;
        } finally {
          client.release();
        }
      }
      case 'mysql': {
        const [rows]: any = await db.query(`SELECT * FROM ?? LIMIT ?`, [table, limit]);
        return rows;
      }
      case 'sqlite': {
        return db.prepare(`SELECT * FROM "${table}" LIMIT ${limit}`).all();
      }
      case 'mongodb': {
        const dbInstance = db.db(this.config.source.database);
        return await dbInstance.collection(table).find().limit(limit).toArray();
      }
      default:
        throw new Error(`Unsupported source type: ${this.config.source.type}`);
    }
  }

  private async insertBatch(db: any, table: string, rows: any[]): Promise<void> {
    if (rows.length === 0) return;

    switch (this.config.target.type) {
      case 'postgres': {
        const client = await db.connect();
        try {
          await client.query('BEGIN');

          const columns = Object.keys(rows[0]);
          const placeholders = rows
            .map((_, rowIdx) =>
              `(${columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`).join(', ')})`
            )
            .join(', ');

          const values = rows.flatMap((row) => columns.map((col) => row[col]));

          const query = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES ${placeholders}`;

          await client.query(query, values);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
        break;
      }
      case 'mysql': {
        const connection = await db.getConnection();
        try {
          await connection.beginTransaction();

          const columns = Object.keys(rows[0]);
          const placeholders = rows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
          const values = rows.flatMap((row) => columns.map((col) => row[col]));

          const query = `INSERT INTO ?? (${columns.map(() => '??').join(', ')}) VALUES ${placeholders}`;

          await connection.query(query, [table, ...columns, ...values]);
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
        break;
      }
      case 'sqlite': {
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(', ');

        const stmt = db.prepare(
          `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`
        );

        const transaction = db.transaction((rows: any[]) => {
          for (const row of rows) {
            stmt.run(columns.map((col) => row[col]));
          }
        });

        transaction(rows);
        break;
      }
      case 'mongodb': {
        const dbInstance = db.db(this.config.target.database);
        await dbInstance.collection(table).insertMany(rows);
        break;
      }
      default:
        throw new Error(`Unsupported target type: ${this.config.target.type}`);
    }
  }

  getLogs(): MigrationLog[] {
    return this.logs;
  }

  getProgress(): MigrationProgress[] {
    return Array.from(this.progress.values());
  }
}
