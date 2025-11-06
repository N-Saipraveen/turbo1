import { TableNodeData } from '@/components/TableNode';

export interface UnifiedSchema {
  tables: TableNodeData[];
  relationships: Array<{
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  }>;
}

export type SchemaType = 'sql' | 'json' | 'mongo' | 'dbml';

/**
 * Detect schema type from content
 */
export function detectSchemaType(content: string): SchemaType {
  const trimmed = content.trim().toLowerCase();

  // SQL detection
  if (
    trimmed.includes('create table') ||
    trimmed.includes('alter table') ||
    trimmed.includes('add constraint')
  ) {
    return 'sql';
  }

  // DBML detection
  if (
    trimmed.includes('table ') &&
    (trimmed.includes('ref:') || trimmed.includes('indexes'))
  ) {
    return 'dbml';
  }

  // MongoDB detection
  if (
    trimmed.includes('db.createcollection') ||
    trimmed.includes('db.') ||
    trimmed.includes('$jsonschema') ||
    (trimmed.startsWith('{') && trimmed.includes('bsontype'))
  ) {
    return 'mongo';
  }

  // JSON detection (default)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }

  // Default to SQL
  return 'sql';
}

/**
 * Parse SQL CREATE TABLE statements
 */
export function parseSqlSchema(content: string): UnifiedSchema {
  const tables: TableNodeData[] = [];
  const relationships: UnifiedSchema['relationships'] = [];

  // Regex to match CREATE TABLE statements
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([\s\S]*?)\);/gi;
  let match;

  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];

    const columns = parseColumns(columnsBlock, tableName, relationships);

    tables.push({
      name: tableName,
      columns,
    });
  }

  return { tables, relationships };
}

function parseColumns(
  columnsBlock: string,
  tableName: string,
  relationships: UnifiedSchema['relationships']
): TableNodeData['columns'] {
  const columns: TableNodeData['columns'] = [];
  const lines = columnsBlock.split(/,(?![^(]*\))/); // Split by commas not inside parentheses

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip CONSTRAINT, FOREIGN KEY, PRIMARY KEY declarations
    if (
      trimmed.toUpperCase().startsWith('CONSTRAINT') ||
      trimmed.toUpperCase().startsWith('FOREIGN KEY') ||
      trimmed.toUpperCase().startsWith('PRIMARY KEY') ||
      trimmed.toUpperCase().startsWith('UNIQUE')
    ) {
      // Extract foreign key relationships
      const fkMatch = /FOREIGN\s+KEY\s*\(\s*[`"']?(\w+)[`"']?\s*\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\(\s*[`"']?(\w+)[`"']?\s*\)/i.exec(
        trimmed
      );
      if (fkMatch) {
        const [, fromColumn, toTable, toColumn] = fkMatch;
        relationships.push({
          fromTable: tableName,
          fromColumn,
          toTable,
          toColumn,
          type: 'one-to-many',
        });

        // Mark column as foreign key
        const col = columns.find((c) => c.name === fromColumn);
        if (col) {
          col.isForeignKey = true;
          col.references = { table: toTable, column: toColumn };
        }
      }
      continue;
    }

    // Parse column definition
    const columnMatch = /^[`"']?(\w+)[`"']?\s+([\w\s()]+)/i.exec(trimmed);
    if (!columnMatch) continue;

    const [, columnName, typeAndConstraints] = columnMatch;

    const column: TableNodeData['columns'][0] = {
      name: columnName,
      type: extractType(typeAndConstraints),
      isPrimaryKey: /PRIMARY\s+KEY/i.test(typeAndConstraints),
      isNullable: !/NOT\s+NULL/i.test(typeAndConstraints),
      isUnique: /UNIQUE/i.test(typeAndConstraints),
    };

    // Check for inline REFERENCES
    const refMatch = /REFERENCES\s+[`"']?(\w+)[`"']?\s*\(\s*[`"']?(\w+)[`"']?\s*\)/i.exec(
      typeAndConstraints
    );
    if (refMatch) {
      const [, refTable, refColumn] = refMatch;
      column.isForeignKey = true;
      column.references = { table: refTable, column: refColumn };

      relationships.push({
        fromTable: tableName,
        fromColumn: columnName,
        toTable: refTable,
        toColumn: refColumn,
        type: 'one-to-many',
      });
    }

    columns.push(column);
  }

  return columns;
}

function extractType(typeAndConstraints: string): string {
  // Extract just the data type part
  const match = /^([\w()]+)/i.exec(typeAndConstraints.trim());
  return match ? match[1].toUpperCase() : 'UNKNOWN';
}

/**
 * Parse JSON schema
 */
export function parseJsonSchema(content: string): UnifiedSchema {
  try {
    const data = JSON.parse(content);
    const tables: TableNodeData[] = [];
    const relationships: UnifiedSchema['relationships'] = [];

    if (Array.isArray(data)) {
      // Array of table definitions
      for (const table of data) {
        if (table.name && table.columns) {
          tables.push({
            name: table.name,
            columns: table.columns.map((col: any) => ({
              name: col.name || col.field,
              type: col.type || 'UNKNOWN',
              isPrimaryKey: col.isPrimaryKey || col.primaryKey || false,
              isForeignKey: col.isForeignKey || col.foreignKey || false,
              isNullable: col.nullable !== false,
              references: col.references,
            })),
            indexes: table.indexes,
          });
        }
      }
    } else if (data.tables) {
      // Object with tables property
      return parseJsonSchema(JSON.stringify(data.tables));
    } else {
      // Single object - infer schema from data
      const tableName = data._collection || data.title || 'main_table';
      const sampleData = Array.isArray(data.data) ? data.data[0] : data;

      const columns = Object.keys(sampleData).map((key) => ({
        name: key,
        type: inferTypeFromValue(sampleData[key]),
        isPrimaryKey: key === 'id' || key === '_id',
        isNullable: true,
      }));

      tables.push({ name: tableName, columns });
    }

    return { tables, relationships };
  } catch (error) {
    throw new Error(`Failed to parse JSON schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function inferTypeFromValue(value: any): string {
  if (value === null || value === undefined) return 'VARCHAR(255)';

  switch (typeof value) {
    case 'boolean':
      return 'BOOLEAN';
    case 'number':
      return Number.isInteger(value) ? 'INTEGER' : 'DECIMAL';
    case 'string':
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return value.includes('T') ? 'TIMESTAMP' : 'DATE';
      }
      return value.length > 255 ? 'TEXT' : 'VARCHAR(255)';
    case 'object':
      if (Array.isArray(value)) return 'JSON';
      return 'JSON';
    default:
      return 'VARCHAR(255)';
  }
}

/**
 * Parse MongoDB schema
 */
export function parseMongoSchema(content: string): UnifiedSchema {
  try {
    const data = JSON.parse(content);
    const tables: TableNodeData[] = [];

    if (Array.isArray(data)) {
      // Array of collection schemas
      for (const collection of data) {
        if (collection.collection && collection.fields) {
          tables.push({
            name: collection.collection,
            columns: collection.fields.map((field: any) => ({
              name: field.name,
              type: field.type || 'Mixed',
              isPrimaryKey: field.name === '_id',
              isNullable: !field.required,
            })),
          });
        }
      }
    } else if (data.collections) {
      return parseMongoSchema(JSON.stringify(data.collections));
    } else {
      // Single collection schema
      const collectionName = data.collection || 'collection';
      const fields = data.fields || [];

      tables.push({
        name: collectionName,
        columns: fields.map((field: any) => ({
          name: field.name,
          type: field.type || 'Mixed',
          isPrimaryKey: field.name === '_id',
          isNullable: !field.required,
        })),
      });
    }

    return { tables, relationships: [] };
  } catch (error) {
    throw new Error(`Failed to parse MongoDB schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main parser that auto-detects and parses schema
 */
export function parseSchema(content: string, type?: SchemaType): UnifiedSchema {
  const detectedType = type || detectSchemaType(content);

  switch (detectedType) {
    case 'sql':
      return parseSqlSchema(content);
    case 'json':
      return parseJsonSchema(content);
    case 'mongo':
      return parseMongoSchema(content);
    case 'dbml':
      // For now, treat DBML as SQL-like
      return parseSqlSchema(content);
    default:
      throw new Error(`Unsupported schema type: ${detectedType}`);
  }
}
