import { parseMongoSchema, type MongoSchemaDefinition, type MongoField } from './mongo.js';
import { mongoToSqlTypeMap, quoteIdentifier, sanitizeSqlIdentifier } from './common.js';

export interface ConvertOutput {
  artifacts: Record<string, string>;
  summary: {
    tables: number;
  };
  warnings: string[];
}

export async function convertMongoToSql(
  mongoContent: string,
  dialect: 'postgres' | 'mysql' | 'sqlite' = 'postgres'
): Promise<ConvertOutput> {
  const warnings: string[] = [];
  const artifacts: Record<string, string> = {};

  try {
    const schemas = parseMongoSchema(mongoContent);

    for (const schema of schemas) {
      const ddl = generateSqlFromMongoSchema(schema, dialect, warnings);
      artifacts[`${sanitizeSqlIdentifier(schema.collection)}.sql`] = ddl;
    }

    return {
      artifacts,
      summary: {
        tables: schemas.length,
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

function generateSqlFromMongoSchema(
  schema: MongoSchemaDefinition,
  dialect: 'postgres' | 'mysql' | 'sqlite',
  warnings: string[]
): string {
  const sanitizedTableName = sanitizeSqlIdentifier(schema.collection);
  const quotedTableName = quoteIdentifier(sanitizedTableName, dialect);

  let ddl = `CREATE TABLE ${quotedTableName} (\n`;

  const columns: string[] = [];

  // Check if schema has _id field from MongoDB
  const hasMongoId = schema.fields.some(f => f.name === '_id');

  if (hasMongoId) {
    // Use MongoDB _id as primary key (TEXT type to store ObjectId string)
    ddl += `  ${quoteIdentifier('_id', dialect)} TEXT PRIMARY KEY,\n`;
  } else {
    // Fall back to auto-increment ID if no _id field
    if (dialect === 'postgres') {
      ddl += `  ${quoteIdentifier('id', dialect)} SERIAL PRIMARY KEY,\n`;
    } else if (dialect === 'mysql') {
      ddl += `  ${quoteIdentifier('id', dialect)} INT AUTO_INCREMENT PRIMARY KEY,\n`;
    } else {
      ddl += `  ${quoteIdentifier('id', dialect)} INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
    }
  }

  for (const field of schema.fields) {
    // Skip _id since we already added it as primary key
    if (field.name === '_id') continue;

    const columnDef = generateColumnFromMongoField(field, dialect, warnings);
    if (columnDef) {
      columns.push(columnDef);
    }
  }

  ddl += columns.join(',\n');
  ddl += '\n);\n';

  // Generate indexes if present
  if (schema.indexes && schema.indexes.length > 0) {
    ddl += '\n-- Indexes\n';
    for (const index of schema.indexes) {
      const indexName = quoteIdentifier(`idx_${sanitizedTableName}_${index.name}`, dialect);
      const indexColumns = Object.keys(index.fields).map(col => quoteIdentifier(col, dialect)).join(', ');
      const unique = index.unique ? 'UNIQUE ' : '';
      ddl += `CREATE ${unique}INDEX ${indexName} ON ${quotedTableName} (${indexColumns});\n`;
    }
  }

  return ddl;
}

function generateColumnFromMongoField(
  field: MongoField,
  dialect: 'postgres' | 'mysql' | 'sqlite',
  warnings: string[]
): string | null {
  const quotedName = quoteIdentifier(sanitizeSqlIdentifier(field.name), dialect);

  // Handle nested objects and arrays
  if (field.nested || field.isArray) {
    warnings.push(`Field ${field.name} is nested/array - converting to JSON column`);
    let sqlType: string;
    if (dialect === 'postgres') {
      sqlType = 'JSONB';
    } else if (dialect === 'mysql') {
      sqlType = 'JSON';
    } else {
      sqlType = 'TEXT';
    }

    let definition = `  ${quotedName} ${sqlType}`;
    if (field.required) {
      definition += ' NOT NULL';
    }
    return definition;
  }

  const sqlType = mapMongoTypeToSql(field.type);

  let definition = `  ${quotedName} ${sqlType}`;

  if (field.required) {
    definition += ' NOT NULL';
  }

  return definition;
}

function mapMongoTypeToSql(mongoType: string): string {
  return mongoToSqlTypeMap[mongoType] || 'VARCHAR(255)';
}
