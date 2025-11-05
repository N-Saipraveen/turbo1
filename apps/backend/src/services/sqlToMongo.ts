import { parseSql, type TableDefinition } from './sql.js';
import { sqlToMongoTypeMap } from './common.js';
import { decideSqlToMongoStrategy } from './mapRules.js';

export interface ConvertOutput {
  artifacts: Record<string, string>;
  summary: {
    collections: number;
    embedDecisions: any[];
  };
  warnings: string[];
}

export async function convertSqlToMongo(
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

    const embedDecisions = decideSqlToMongoStrategy(tables);

    for (const table of tables) {
      // Generate collection setup script
      const setupScript = generateCollectionSetup(table);
      artifacts[`${table.name}_setup.js`] = setupScript;

      // Generate validation rules
      const validationRules = generateValidationRules(table);
      artifacts[`${table.name}_validation.json`] = JSON.stringify(validationRules, null, 2);
    }

    // Generate index creation script
    artifacts['create_indexes.js'] = generateIndexScript(tables);

    return {
      artifacts,
      summary: {
        collections: tables.length,
        embedDecisions,
      },
      warnings,
    };
  } catch (error) {
    warnings.push(`Conversion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      artifacts: {},
      summary: { collections: 0, embedDecisions: [] },
      warnings,
    };
  }
}

function generateCollectionSetup(table: TableDefinition): string {
  const collectionName = table.name.toLowerCase();

  let script = `// Collection setup for ${table.name}\n`;
  script += `db.createCollection("${collectionName}", {\n`;
  script += `  validator: {\n`;
  script += `    $jsonSchema: {\n`;
  script += `      bsonType: "object",\n`;
  script += `      required: [${table.columns.filter(c => !c.nullable).map(c => `"${c.name}"`).join(', ')}],\n`;
  script += `      properties: {\n`;

  for (const column of table.columns) {
    const mongoType = mapSqlTypeToMongoType(column.type);
    script += `        ${column.name}: {\n`;
    script += `          bsonType: "${mongoType}",\n`;
    if (column.type.toUpperCase().includes('VARCHAR')) {
      const match = column.type.match(/\((\d+)\)/);
      if (match) {
        script += `          maxLength: ${match[1]},\n`;
      }
    }
    script += `        },\n`;
  }

  script += `      }\n`;
  script += `    }\n`;
  script += `  }\n`;
  script += `});\n`;

  return script;
}

function generateValidationRules(table: TableDefinition): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const column of table.columns) {
    const mongoType = mapSqlTypeToMongoType(column.type);

    properties[column.name] = {
      bsonType: mongoType,
    };

    if (!column.nullable) {
      required.push(column.name);
    }
  }

  return {
    $jsonSchema: {
      bsonType: 'object',
      required,
      properties,
    },
  };
}

function generateIndexScript(tables: TableDefinition[]): string {
  let script = '// Create indexes for all collections\n\n';

  for (const table of tables) {
    const collectionName = table.name.toLowerCase();

    // Primary key indexes
    if (table.primaryKeys.length > 0) {
      script += `db.${collectionName}.createIndex({\n`;
      for (const pk of table.primaryKeys) {
        script += `  ${pk}: 1,\n`;
      }
      script += `}, { unique: true });\n\n`;
    }

    // Foreign key indexes (for reference fields)
    for (const fk of table.foreignKeys) {
      script += `db.${collectionName}.createIndex({ ${fk.column}: 1 });\n`;
    }

    // Unique constraints
    for (const constraint of table.constraints) {
      if (constraint.type === 'UNIQUE') {
        script += `db.${collectionName}.createIndex({\n`;
        for (const col of constraint.columns) {
          script += `  ${col}: 1,\n`;
        }
        script += `}, { unique: true });\n\n`;
      }
    }
  }

  return script;
}

function mapSqlTypeToMongoType(sqlType: string): string {
  const upperType = sqlType.toUpperCase().split('(')[0];
  return sqlToMongoTypeMap[upperType] || 'string';
}
