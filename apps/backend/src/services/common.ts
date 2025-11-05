// Type mapping between SQL, MongoDB, and JSON Schema
export const sqlToMongoTypeMap: Record<string, string> = {
  INT: 'int',
  INTEGER: 'int',
  BIGINT: 'long',
  SMALLINT: 'int',
  TINYINT: 'int',
  DECIMAL: 'decimal',
  NUMERIC: 'decimal',
  FLOAT: 'double',
  DOUBLE: 'double',
  REAL: 'double',
  VARCHAR: 'string',
  CHAR: 'string',
  TEXT: 'string',
  BOOLEAN: 'bool',
  BOOL: 'bool',
  DATE: 'date',
  DATETIME: 'date',
  TIMESTAMP: 'date',
  TIME: 'string',
  JSON: 'object',
  JSONB: 'object',
  BLOB: 'binData',
  BINARY: 'binData',
};

export const sqlToJsonSchemaTypeMap: Record<string, string> = {
  INT: 'integer',
  INTEGER: 'integer',
  BIGINT: 'integer',
  SMALLINT: 'integer',
  TINYINT: 'integer',
  DECIMAL: 'number',
  NUMERIC: 'number',
  FLOAT: 'number',
  DOUBLE: 'number',
  REAL: 'number',
  VARCHAR: 'string',
  CHAR: 'string',
  TEXT: 'string',
  BOOLEAN: 'boolean',
  BOOL: 'boolean',
  DATE: 'string',
  DATETIME: 'string',
  TIMESTAMP: 'string',
  TIME: 'string',
  JSON: 'object',
  JSONB: 'object',
  BLOB: 'string',
  BINARY: 'string',
};

export const mongoToSqlTypeMap: Record<string, string> = {
  int: 'INTEGER',
  long: 'BIGINT',
  decimal: 'DECIMAL',
  double: 'DOUBLE',
  string: 'VARCHAR(255)',
  bool: 'BOOLEAN',
  date: 'TIMESTAMP',
  object: 'JSON',
  array: 'JSON',
  binData: 'BLOB',
};

export const jsonSchemaToSqlTypeMap: Record<string, string> = {
  integer: 'INTEGER',
  number: 'DECIMAL',
  string: 'VARCHAR(255)',
  boolean: 'BOOLEAN',
  object: 'JSON',
  array: 'JSON',
};

// Sanitize identifiers for SQL
export function sanitizeSqlIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

// Quote identifier based on dialect
export function quoteIdentifier(name: string, dialect: 'postgres' | 'mysql' | 'sqlite' = 'postgres'): string {
  const sanitized = sanitizeSqlIdentifier(name);
  switch (dialect) {
    case 'postgres':
      return `"${sanitized}"`;
    case 'mysql':
      return `\`${sanitized}\``;
    case 'sqlite':
      return `"${sanitized}"`;
    default:
      return sanitized;
  }
}

// Convert camelCase/PascalCase to snake_case
export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

// Convert snake_case to camelCase
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
