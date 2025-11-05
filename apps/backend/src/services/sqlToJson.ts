import { parseSql, type TableDefinition } from './sql.js';
import { sqlToJsonSchemaTypeMap } from './common.js';

export interface ConvertOutput {
  artifacts: Record<string, string>;
  summary: {
    tables: number;
    schemas: string[];
  };
  warnings: string[];
}

export async function convertSqlToJson(
  sql: string,
  dialect: 'postgres' | 'mysql' | 'sqlite' = 'postgres'
): Promise<ConvertOutput> {
  const warnings: string[] = [];
  const artifacts: Record<string, string> = {};

  try {
    const tables = parseSql(sql, dialect);

    if (tables.length === 0) {
      warnings.push('No tables found in SQL');
    }

    for (const table of tables) {
      const schema = generateJsonSchema(table);
      artifacts[`${table.name}.schema.json`] = JSON.stringify(schema, null, 2);
    }

    return {
      artifacts,
      summary: {
        tables: tables.length,
        schemas: Object.keys(artifacts),
      },
      warnings,
    };
  } catch (error) {
    warnings.push(`Conversion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      artifacts: {},
      summary: { tables: 0, schemas: [] },
      warnings,
    };
  }
}

function generateJsonSchema(table: TableDefinition): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const column of table.columns) {
    const jsonType = mapSqlTypeToJsonSchemaType(column.type);

    properties[column.name] = {
      type: jsonType,
    };

    if (column.type.toUpperCase().includes('VARCHAR')) {
      const match = column.type.match(/\((\d+)\)/);
      if (match) {
        properties[column.name].maxLength = parseInt(match[1], 10);
      }
    }

    if (!column.nullable) {
      required.push(column.name);
    }

    if (column.defaultValue) {
      properties[column.name].default = parseDefaultValue(column.defaultValue, jsonType);
    }
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: table.name,
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

function mapSqlTypeToJsonSchemaType(sqlType: string): string {
  const upperType = sqlType.toUpperCase().split('(')[0];
  return sqlToJsonSchemaTypeMap[upperType] || 'string';
}

function parseDefaultValue(defaultValue: string, jsonType: string): any {
  if (jsonType === 'integer' || jsonType === 'number') {
    return parseFloat(defaultValue);
  }
  if (jsonType === 'boolean') {
    return defaultValue.toLowerCase() === 'true' || defaultValue === '1';
  }
  return defaultValue.replace(/^'|'$/g, '');
}
