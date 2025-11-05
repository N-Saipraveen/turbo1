import { parseJson, type JsonSchemaDefinition } from './json.js';
import { jsonSchemaToSqlTypeMap, quoteIdentifier, sanitizeSqlIdentifier } from './common.js';

export interface ConvertOutput {
  artifacts: Record<string, string>;
  summary: {
    tables: number;
  };
  warnings: string[];
}

export async function convertJsonToSql(
  jsonContent: string,
  dialect: 'postgres' | 'mysql' | 'sqlite' = 'postgres'
): Promise<ConvertOutput> {
  const warnings: string[] = [];
  const artifacts: Record<string, string> = {};

  try {
    const data = parseJson(jsonContent);

    // Check if it's a JSON Schema or raw data
    let schema: JsonSchemaDefinition;
    if (data.$schema || (data.type && data.properties)) {
      // It's a JSON Schema
      schema = data as JsonSchemaDefinition;
    } else {
      // It's raw data, need to infer schema
      warnings.push('Inferring schema from data - consider providing JSON Schema for better results');
      schema = inferSchemaFromData(data);
    }

    const tableName = schema.title || 'generated_table';
    const ddl = generateSqlDdl(tableName, schema, dialect);

    artifacts[`${sanitizeSqlIdentifier(tableName)}.sql`] = ddl;

    return {
      artifacts,
      summary: {
        tables: 1,
      },
      warnings,
    };
  } catch (error) {
    warnings.push(`Conversion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      artifacts: {},
      summary: { tables: 0 },
      warnings,
    };
  }
}

function generateSqlDdl(
  tableName: string,
  schema: JsonSchemaDefinition,
  dialect: 'postgres' | 'mysql' | 'sqlite'
): string {
  const sanitizedTableName = sanitizeSqlIdentifier(tableName);
  const quotedTableName = quoteIdentifier(sanitizedTableName, dialect);

  let ddl = `CREATE TABLE ${quotedTableName} (\n`;

  // Add ID column
  if (dialect === 'postgres') {
    ddl += `  ${quoteIdentifier('id', dialect)} SERIAL PRIMARY KEY,\n`;
  } else if (dialect === 'mysql') {
    ddl += `  ${quoteIdentifier('id', dialect)} INT AUTO_INCREMENT PRIMARY KEY,\n`;
  } else {
    ddl += `  ${quoteIdentifier('id', dialect)} INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
  }

  const columns: string[] = [];

  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const columnDef = generateColumnDefinition(propName, propSchema, schema.required?.includes(propName) ?? false, dialect);
      columns.push(columnDef);
    }
  }

  ddl += columns.join(',\n');
  ddl += '\n);\n';

  return ddl;
}

function generateColumnDefinition(
  name: string,
  propSchema: any,
  isRequired: boolean,
  dialect: 'postgres' | 'mysql' | 'sqlite'
): string {
  const quotedName = quoteIdentifier(sanitizeSqlIdentifier(name), dialect);
  const sqlType = mapJsonSchemaTypeToSql(propSchema, dialect);

  let definition = `  ${quotedName} ${sqlType}`;

  if (isRequired) {
    definition += ' NOT NULL';
  }

  if (propSchema.default !== undefined) {
    definition += ` DEFAULT ${formatDefaultValue(propSchema.default, propSchema.type)}`;
  }

  return definition;
}

function mapJsonSchemaTypeToSql(propSchema: any, dialect: 'postgres' | 'mysql' | 'sqlite'): string {
  const type = propSchema.type;

  if (type === 'object' || type === 'array') {
    if (dialect === 'postgres') {
      return 'JSONB';
    } else if (dialect === 'mysql') {
      return 'JSON';
    } else {
      return 'TEXT';
    }
  }

  const baseType = jsonSchemaToSqlTypeMap[type] || 'VARCHAR(255)';

  if (type === 'string' && propSchema.maxLength) {
    return `VARCHAR(${propSchema.maxLength})`;
  }

  if (type === 'number' && propSchema.multipleOf === 1) {
    return 'INTEGER';
  }

  return baseType;
}

function formatDefaultValue(value: any, type: string): string {
  if (type === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (type === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  return String(value);
}

function inferSchemaFromData(data: any): JsonSchemaDefinition {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { type: 'object', properties: {} };
    }
    return inferSchemaFromData(data[0]);
  }

  if (typeof data === 'object' && data !== null) {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      properties[key] = inferPropertySchema(value);
      if (value !== null && value !== undefined) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }

  return { type: 'object', properties: {} };
}

function inferPropertySchema(value: any): any {
  if (value === null) {
    return { type: 'string' };
  }

  if (Array.isArray(value)) {
    return { type: 'array', items: value.length > 0 ? inferPropertySchema(value[0]) : { type: 'string' } };
  }

  if (typeof value === 'object') {
    return { type: 'object' };
  }

  switch (typeof value) {
    case 'string':
      return { type: 'string', maxLength: Math.max(255, value.length) };
    case 'number':
      return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    default:
      return { type: 'string' };
  }
}
