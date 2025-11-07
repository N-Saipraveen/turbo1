/**
 * Migration Logging Utility
 *
 * Provides comprehensive logging for debugging migration issues:
 * - Table creation timing
 * - Batch insert performance
 * - Constraint failures
 * - SQL statement logging
 * - Progress tracking
 */

import { createLogger, format, transports } from 'winston';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface MigrationLogEntry {
  timestamp: Date;
  level: LogLevel;
  phase: string;
  message: string;
  metadata?: Record<string, any>;
  sql?: string;
  duration?: number;
  error?: Error;
}

export class MigrationLogger {
  private logger: ReturnType<typeof createLogger>;
  private startTime: number;
  private phaseStartTimes: Map<string, number> = new Map();
  private logs: MigrationLogEntry[] = [];

  constructor(private migrationId: string) {
    this.startTime = Date.now();

    this.logger = createLogger({
      level: 'debug',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
      ),
      defaultMeta: { migrationId },
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, ...metadata }) => {
              let msg = `${timestamp} [${level}]: ${message}`;
              if (Object.keys(metadata).length > 0) {
                msg += ` ${JSON.stringify(metadata)}`;
              }
              return msg;
            })
          ),
        }),
      ],
    });
  }

  /**
   * Start timing a phase
   */
  startPhase(phase: string, metadata?: Record<string, any>) {
    this.phaseStartTimes.set(phase, Date.now());
    this.log(LogLevel.INFO, phase, `Started phase: ${phase}`, metadata);
  }

  /**
   * End timing a phase
   */
  endPhase(phase: string, metadata?: Record<string, any>) {
    const startTime = this.phaseStartTimes.get(phase);
    const duration = startTime ? Date.now() - startTime : 0;
    this.phaseStartTimes.delete(phase);

    this.log(LogLevel.INFO, phase, `Completed phase: ${phase}`, {
      ...metadata,
      duration: `${duration}ms`,
    });

    return duration;
  }

  /**
   * Log table creation
   */
  logTableCreation(tableName: string, sql: string) {
    this.log(LogLevel.DEBUG, 'schema', `Creating table: ${tableName}`, { sql });
  }

  /**
   * Log batch insert
   */
  logBatchInsert(tableName: string, rowCount: number, duration: number) {
    const rowsPerSecond = Math.round((rowCount / duration) * 1000);
    this.log(LogLevel.INFO, 'insert', `Batch inserted ${rowCount} rows into ${tableName}`, {
      rowCount,
      duration: `${duration}ms`,
      rowsPerSecond,
    });
  }

  /**
   * Log constraint error
   */
  logConstraintError(constraintName: string, error: Error, sql?: string) {
    this.log(
      LogLevel.ERROR,
      'constraint',
      `Constraint error: ${constraintName}`,
      { sql },
      error
    );
  }

  /**
   * Log SQL execution
   */
  logSQL(sql: string, duration?: number) {
    const metadata: any = { sql: sql.length > 500 ? sql.substring(0, 500) + '...' : sql };
    if (duration) {
      metadata.duration = `${duration}ms`;
    }
    this.log(LogLevel.DEBUG, 'sql', 'Executing SQL', metadata);
  }

  /**
   * Log progress update
   */
  logProgress(table: string, current: number, total: number, percentage: number) {
    this.log(LogLevel.INFO, 'progress', `${table}: ${current}/${total} (${percentage}%)`, {
      table,
      current,
      total,
      percentage,
    });
  }

  /**
   * Log warning
   */
  warn(phase: string, message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.WARN, phase, message, metadata);
  }

  /**
   * Log error
   */
  error(phase: string, message: string, error?: Error, metadata?: Record<string, any>) {
    this.log(LogLevel.ERROR, phase, message, metadata, error);
  }

  /**
   * Log debug message
   */
  debug(phase: string, message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.DEBUG, phase, message, metadata);
  }

  /**
   * Log info message
   */
  info(phase: string, message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.INFO, phase, message, metadata);
  }

  /**
   * Core logging function
   */
  private log(
    level: LogLevel,
    phase: string,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ) {
    const entry: MigrationLogEntry = {
      timestamp: new Date(),
      level,
      phase,
      message,
      metadata,
      error,
    };

    this.logs.push(entry);

    // Log to Winston
    const logData: Record<string, any> = {
      ...metadata,
      phase,
    };

    if (error) {
      logData.error = {
        message: error.message,
        stack: error.stack,
      };
    }

    this.logger[level as 'info' | 'warn' | 'error' | 'debug'](message, logData);
  }

  /**
   * Get all logs
   */
  getLogs(): MigrationLogEntry[] {
    return this.logs;
  }

  /**
   * Get migration summary
   */
  getSummary() {
    const totalDuration = Date.now() - this.startTime;
    const errors = this.logs.filter(l => l.level === LogLevel.ERROR);
    const warnings = this.logs.filter(l => l.level === LogLevel.WARN);

    return {
      migrationId: this.migrationId,
      totalDuration: `${totalDuration}ms`,
      totalLogs: this.logs.length,
      errors: errors.length,
      warnings: warnings.length,
      phases: Array.from(this.phaseStartTimes.keys()),
    };
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(
      {
        summary: this.getSummary(),
        logs: this.logs,
      },
      null,
      2
    );
  }
}

/**
 * Create a migration logger instance
 */
export function createMigrationLogger(migrationId?: string): MigrationLogger {
  return new MigrationLogger(migrationId || `migration-${Date.now()}`);
}
