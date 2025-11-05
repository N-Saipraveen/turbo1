import type { TableDefinition } from './sql.js';

export interface MappingRule {
  sourceField: string;
  targetField: string;
  sourceType: string;
  targetType: string;
  transform?: string;
  reasoning?: string;
}

export interface EmbedVsReferenceDecision {
  table: string;
  decision: 'embed' | 'reference';
  reasoning: string;
}

export function decideSqlToMongoStrategy(
  tables: TableDefinition[]
): EmbedVsReferenceDecision[] {
  const decisions: EmbedVsReferenceDecision[] = [];

  for (const table of tables) {
    // Simple heuristic: tables with few columns and no outgoing FKs are candidates for embedding
    const hasOutgoingFKs = table.foreignKeys.length > 0;
    const isReferencedByMany = tables.some(t =>
      t.foreignKeys.some(fk => fk.referencedTable === table.name)
    );

    let decision: 'embed' | 'reference' = 'reference';
    let reasoning = 'Default to reference for flexibility';

    if (!hasOutgoingFKs && table.columns.length <= 5 && isReferencedByMany) {
      decision = 'embed';
      reasoning = 'Small table with no dependencies, frequently referenced - good candidate for embedding';
    } else if (hasOutgoingFKs) {
      decision = 'reference';
      reasoning = 'Table has foreign key relationships - maintain as separate collection';
    }

    decisions.push({
      table: table.name,
      decision,
      reasoning,
    });
  }

  return decisions;
}

export function generateMappingRules(
  source: any,
  _target: any,
  direction: 'sql-to-mongo' | 'sql-to-json' | 'mongo-to-sql' | 'json-to-sql'
): MappingRule[] {
  const rules: MappingRule[] = [];

  switch (direction) {
    case 'sql-to-mongo':
      // Generate rules for SQL to MongoDB conversion
      if (Array.isArray(source)) {
        for (const table of source as TableDefinition[]) {
          for (const column of table.columns) {
            rules.push({
              sourceField: `${table.name}.${column.name}`,
              targetField: column.name,
              sourceType: column.type,
              targetType: mapSqlTypeToMongo(column.type),
              reasoning: 'Direct type mapping',
            });
          }
        }
      }
      break;

    case 'sql-to-json':
      // Generate rules for SQL to JSON Schema conversion
      if (Array.isArray(source)) {
        for (const table of source as TableDefinition[]) {
          for (const column of table.columns) {
            rules.push({
              sourceField: `${table.name}.${column.name}`,
              targetField: column.name,
              sourceType: column.type,
              targetType: mapSqlTypeToJsonSchema(column.type),
              reasoning: 'Direct type mapping to JSON Schema',
            });
          }
        }
      }
      break;

    // Add other directions as needed
  }

  return rules;
}

function mapSqlTypeToMongo(sqlType: string): string {
  const upperType = sqlType.toUpperCase();

  if (upperType.includes('INT')) return 'int';
  if (upperType.includes('BIGINT')) return 'long';
  if (upperType.includes('DECIMAL') || upperType.includes('NUMERIC')) return 'decimal';
  if (upperType.includes('FLOAT') || upperType.includes('DOUBLE') || upperType.includes('REAL')) return 'double';
  if (upperType.includes('CHAR') || upperType.includes('TEXT')) return 'string';
  if (upperType.includes('BOOL')) return 'bool';
  if (upperType.includes('DATE') || upperType.includes('TIME')) return 'date';
  if (upperType.includes('JSON')) return 'object';
  if (upperType.includes('BLOB') || upperType.includes('BINARY')) return 'binData';

  return 'string';
}

function mapSqlTypeToJsonSchema(sqlType: string): string {
  const upperType = sqlType.toUpperCase();

  if (upperType.includes('INT')) return 'integer';
  if (upperType.includes('DECIMAL') || upperType.includes('NUMERIC') || upperType.includes('FLOAT') || upperType.includes('DOUBLE')) return 'number';
  if (upperType.includes('CHAR') || upperType.includes('TEXT')) return 'string';
  if (upperType.includes('BOOL')) return 'boolean';
  if (upperType.includes('DATE') || upperType.includes('TIME')) return 'string';
  if (upperType.includes('JSON')) return 'object';

  return 'string';
}
