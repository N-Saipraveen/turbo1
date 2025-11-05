import { parseJson } from './json.js';
import { quoteIdentifier, sanitizeSqlIdentifier, toSnakeCase } from './common.js';

export interface ConvertOutput {
  artifacts: Record<string, string>;
  summary: {
    tables: number;
    relationships: number;
  };
  warnings: string[];
}

interface TableDefinition {
  name: string;
  columns: ColumnDef[];
  foreignKeys: ForeignKeyDef[];
  uniqueConstraints: string[];
}

interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  isPrimaryKey?: boolean;
}

interface ForeignKeyDef {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export async function convertJsonToSql(
  jsonContent: string,
  dialect: 'postgres' | 'mysql' | 'sqlite' = 'postgres'
): Promise<ConvertOutput> {
  const warnings: string[] = [];
  const artifacts: Record<string, string> = {};

  try {
    const data = parseJson(jsonContent);

    // Determine if it's array or single object
    const records = Array.isArray(data) ? data : [data];

    if (records.length === 0) {
      warnings.push('No data provided');
      return { artifacts: {}, summary: { tables: 0, relationships: 0 }, warnings };
    }

    // Infer table name from data or use default
    const mainTableName = sanitizeSqlIdentifier(
      data._collection || data.title || 'main_table'
    );

    // Analyze structure and create normalized schema
    const tables = analyzeAndNormalizeSchema(records, mainTableName, dialect);

    // Generate DDL
    const ddl = generateNormalizedDdl(tables, dialect);

    artifacts[`${mainTableName}.sql`] = ddl;

    const totalRelationships = tables.reduce((sum, t) => sum + t.foreignKeys.length, 0);

    return {
      artifacts,
      summary: {
        tables: tables.length,
        relationships: totalRelationships,
      },
      warnings,
    };
  } catch (error) {
    warnings.push(`Conversion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      artifacts: {},
      summary: { tables: 0, relationships: 0 },
      warnings,
    };
  }
}

function analyzeAndNormalizeSchema(
  records: any[],
  mainTableName: string,
  dialect: 'postgres' | 'mysql' | 'sqlite'
): TableDefinition[] {
  const tables: TableDefinition[] = [];
  const sample = records[0]; // Use first record as schema template

  // Create main table
  const mainTable: TableDefinition = {
    name: mainTableName,
    columns: [],
    foreignKeys: [],
    uniqueConstraints: [],
  };

  // Add primary key
  const hasPrimaryKey = sample.hasOwnProperty('id');
  if (hasPrimaryKey) {
    mainTable.columns.push({
      name: 'id',
      type: inferSqlType('id', sample.id, dialect),
      nullable: false,
      isPrimaryKey: true,
    });
  } else {
    // Generate auto-increment PK
    mainTable.columns.push({
      name: 'id',
      type: dialect === 'postgres' ? 'SERIAL' : dialect === 'mysql' ? 'INT AUTO_INCREMENT' : 'INTEGER',
      nullable: false,
      isPrimaryKey: true,
    });
  }

  // Process each field
  for (const [fieldName, value] of Object.entries(sample)) {
    if (fieldName === '_collection' || fieldName === 'id') continue;

    // Check if it's a nested object
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Create separate table for nested object
      const relatedTableName = `${mainTableName}_${sanitizeSqlIdentifier(fieldName)}`;
      const relatedTable = createRelatedTable(
        relatedTableName,
        value,
        mainTableName,
        dialect
      );
      tables.push(relatedTable);

      // Don't add column to main table - relationship handled via foreign key in related table
      continue;
    }

    // Check if it's an array
    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object') {
        // Create child table for array of objects
        const childTableName = `${mainTableName}_${sanitizeSqlIdentifier(fieldName)}`;
        const childTable = createChildTable(
          childTableName,
          value[0],
          mainTableName,
          dialect
        );
        tables.push(childTable);
      }
      // Skip arrays in main table - they're normalized
      continue;
    }

    // Regular scalar field
    const sqlType = inferSqlType(fieldName, value, dialect);
    const isRequired = value !== null && value !== undefined;

    // Check if it's a self-referential foreign key
    if (fieldName.endsWith('_id')) {
      const baseName = fieldName.replace(/_id$/, '');
      // Common self-referential patterns
      const selfReferentialPatterns = ['manager', 'supervisor', 'parent', 'reports_to', 'referred_by'];

      if (selfReferentialPatterns.includes(baseName)) {
        mainTable.foreignKeys.push({
          column: fieldName,
          referencedTable: mainTableName,
          referencedColumn: 'id',
        });
      }
    }

    // Check for unique constraints (emails, usernames)
    const shouldBeUnique = isUniqueField(fieldName, value);
    if (shouldBeUnique) {
      mainTable.uniqueConstraints.push(fieldName);
    }

    mainTable.columns.push({
      name: fieldName,
      type: sqlType,
      nullable: !isRequired,
    });
  }

  tables.unshift(mainTable); // Main table goes first
  return tables;
}

function createRelatedTable(
  tableName: string,
  nestedObject: any,
  parentTableName: string,
  dialect: 'postgres' | 'mysql' | 'sqlite'
): TableDefinition {
  const table: TableDefinition = {
    name: tableName,
    columns: [],
    foreignKeys: [],
    uniqueConstraints: [],
  };

  // Add auto-increment PK
  table.columns.push({
    name: 'id',
    type: dialect === 'postgres' ? 'SERIAL' : dialect === 'mysql' ? 'INT AUTO_INCREMENT' : 'INTEGER',
    nullable: false,
    isPrimaryKey: true,
  });

  // Add foreign key to parent
  table.columns.push({
    name: `${toSnakeCase(parentTableName)}_id`,
    type: 'INT',
    nullable: false,
  });

  table.foreignKeys.push({
    column: `${toSnakeCase(parentTableName)}_id`,
    referencedTable: parentTableName,
    referencedColumn: 'id',
  });

  // Add fields from nested object
  for (const [fieldName, value] of Object.entries(nestedObject)) {
    const sqlType = inferSqlType(fieldName, value, dialect);
    table.columns.push({
      name: fieldName,
      type: sqlType,
      nullable: value === null || value === undefined,
    });
  }

  return table;
}

function createChildTable(
  tableName: string,
  childObject: any,
  parentTableName: string,
  dialect: 'postgres' | 'mysql' | 'sqlite'
): TableDefinition {
  const table: TableDefinition = {
    name: tableName,
    columns: [],
    foreignKeys: [],
    uniqueConstraints: [],
  };

  // Add auto-increment PK
  table.columns.push({
    name: 'id',
    type: dialect === 'postgres' ? 'SERIAL' : dialect === 'mysql' ? 'INT AUTO_INCREMENT' : 'INTEGER',
    nullable: false,
    isPrimaryKey: true,
  });

  // Add foreign key to parent
  const parentIdColumn = `${toSnakeCase(parentTableName)}_id`;
  table.columns.push({
    name: parentIdColumn,
    type: 'INT',
    nullable: false,
  });

  table.foreignKeys.push({
    column: parentIdColumn,
    referencedTable: parentTableName,
    referencedColumn: 'id',
  });

  // Add fields from child object
  for (const [fieldName, value] of Object.entries(childObject)) {
    const sqlType = inferSqlType(fieldName, value, dialect);
    table.columns.push({
      name: fieldName,
      type: sqlType,
      nullable: value === null || value === undefined,
    });
  }

  return table;
}

function inferSqlType(
  fieldName: string,
  value: any,
  dialect: 'postgres' | 'mysql' | 'sqlite'
): string {
  const lowerFieldName = fieldName.toLowerCase();

  // ID fields
  if (lowerFieldName === 'id' || lowerFieldName.endsWith('_id')) {
    return dialect === 'postgres' ? 'INTEGER' : 'INT';
  }

  // Phone numbers
  if (lowerFieldName.includes('phone') || lowerFieldName.includes('mobile')) {
    return 'VARCHAR(25)';
  }

  // Email addresses
  if (lowerFieldName.includes('email')) {
    return 'VARCHAR(255)';
  }

  // Monetary values
  if (
    lowerFieldName.includes('price') ||
    lowerFieldName.includes('salary') ||
    lowerFieldName.includes('amount') ||
    lowerFieldName.includes('cost') ||
    lowerFieldName.includes('budget')
  ) {
    return 'DECIMAL(12,2)';
  }

  // Dates
  if (
    lowerFieldName.includes('date') ||
    lowerFieldName.includes('_at') ||
    lowerFieldName.includes('_on')
  ) {
    if (typeof value === 'string' && value.includes('T')) {
      return dialect === 'postgres' ? 'TIMESTAMP' : 'DATETIME';
    }
    return 'DATE';
  }

  // Infer from actual value
  if (value === null || value === undefined) {
    return 'VARCHAR(255)';
  }

  switch (typeof value) {
    case 'boolean':
      return 'BOOLEAN';

    case 'number':
      if (Number.isInteger(value)) {
        // Check magnitude
        if (value > 2147483647 || value < -2147483648) {
          return 'BIGINT';
        }
        return 'INT';
      }
      return 'DECIMAL(12,2)';

    case 'string':
      // Check for date patterns
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        if (value.includes('T')) {
          return dialect === 'postgres' ? 'TIMESTAMP' : 'DATETIME';
        }
        return 'DATE';
      }

      // Check for email pattern
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'VARCHAR(255)';
      }

      // Check for phone pattern
      if (/^[\d\s\-\(\)\+]{8,20}$/.test(value)) {
        return 'VARCHAR(25)';
      }

      // Check length
      if (value.length > 255) {
        return 'TEXT';
      }

      return 'VARCHAR(255)';

    default:
      return 'VARCHAR(255)';
  }
}

function isUniqueField(fieldName: string, value: any): boolean {
  const lowerName = fieldName.toLowerCase();

  if (
    lowerName.includes('email') ||
    lowerName.includes('username') ||
    lowerName === 'ssn' ||
    lowerName === 'passport'
  ) {
    return true;
  }

  return false;
}

function generateNormalizedDdl(
  tables: TableDefinition[],
  dialect: 'postgres' | 'mysql' | 'sqlite'
): string {
  let ddl = '-- Normalized Relational Schema\n';
  ddl += '-- Generated from JSON data\n\n';

  for (const table of tables) {
    const quotedTableName = quoteIdentifier(table.name, dialect);

    ddl += `CREATE TABLE ${quotedTableName} (\n`;

    const columnDefs: string[] = [];

    // Add columns
    for (const col of table.columns) {
      const quotedColName = quoteIdentifier(col.name, dialect);
      let def = `  ${quotedColName} ${col.type}`;

      if (col.isPrimaryKey && !col.type.includes('SERIAL') && !col.type.includes('AUTO_INCREMENT') && !col.type.includes('AUTOINCREMENT')) {
        def += ' PRIMARY KEY';
      }

      if (!col.nullable && !col.isPrimaryKey) {
        def += ' NOT NULL';
      }

      if (col.default) {
        def += ` DEFAULT ${col.default}`;
      }

      columnDefs.push(def);
    }

    // Handle SERIAL/AUTO_INCREMENT primary keys
    const pkColumn = table.columns.find(c => c.isPrimaryKey);
    if (pkColumn && (pkColumn.type.includes('SERIAL') || pkColumn.type.includes('AUTO_INCREMENT') || pkColumn.type.includes('AUTOINCREMENT'))) {
      if (dialect === 'postgres') {
        // SERIAL already implies PRIMARY KEY
        columnDefs[0] = `  ${quoteIdentifier(pkColumn.name, dialect)} SERIAL PRIMARY KEY`;
      } else if (dialect === 'mysql') {
        columnDefs[0] = `  ${quoteIdentifier(pkColumn.name, dialect)} INT AUTO_INCREMENT PRIMARY KEY`;
      } else {
        columnDefs[0] = `  ${quoteIdentifier(pkColumn.name, dialect)} INTEGER PRIMARY KEY AUTOINCREMENT`;
      }
    }

    // Add unique constraints
    for (const uniqueCol of table.uniqueConstraints) {
      const quotedCol = quoteIdentifier(uniqueCol, dialect);
      const idx = columnDefs.findIndex(def => def.includes(quotedCol));
      if (idx !== -1) {
        columnDefs[idx] += ' UNIQUE';
      }
    }

    // Add foreign keys
    for (const fk of table.foreignKeys) {
      const quotedCol = quoteIdentifier(fk.column, dialect);
      const quotedRefTable = quoteIdentifier(fk.referencedTable, dialect);
      const quotedRefCol = quoteIdentifier(fk.referencedColumn, dialect);

      columnDefs.push(
        `  FOREIGN KEY (${quotedCol}) REFERENCES ${quotedRefTable}(${quotedRefCol})`
      );
    }

    ddl += columnDefs.join(',\n');
    ddl += '\n);\n\n';
  }

  return ddl.trim();
}
