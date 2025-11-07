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
  primaryKey?: string; // Store the actual PK column name (e.g., '_id' for MongoDB, 'id' for SQL)
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

/**
 * Detect if an object has a primary key field
 */
function detectPrimaryKey(obj: any): string | null {
  const pkCandidates = ['id', '_id', 'uuid', 'ID', 'Id', 'UUID'];

  for (const candidate of pkCandidates) {
    if (obj.hasOwnProperty(candidate)) {
      return candidate;
    }
  }

  return null;
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

  // Detect existing primary key
  const existingPK = detectPrimaryKey(sample);

  if (existingPK) {
    // Use existing primary key field
    mainTable.primaryKey = existingPK;
    mainTable.columns.push({
      name: existingPK,
      type: inferSqlType(existingPK, sample[existingPK], dialect),
      nullable: false,
      isPrimaryKey: true,
    });
  } else {
    // Generate auto-increment PK only if no existing PK
    mainTable.primaryKey = 'id';
    mainTable.columns.push({
      name: 'id',
      type: dialect === 'postgres' ? 'SERIAL' : dialect === 'mysql' ? 'INT AUTO_INCREMENT' : 'INTEGER',
      nullable: false,
      isPrimaryKey: true,
    });
  }

  // Process each field
  for (const [fieldName, value] of Object.entries(sample)) {
    // Skip internal fields and the primary key we already added
    if (fieldName === '_collection' || fieldName === existingPK) continue;

    // Check if it's a nested object
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Create separate table for nested object
      const relatedTableName = `${mainTableName}_${sanitizeSqlIdentifier(fieldName)}`;
      const relatedTable = createRelatedTable(
        relatedTableName,
        value,
        mainTable,
        dialect
      );
      tables.push(relatedTable);

      // Don't add column to main table - relationship handled via foreign key in related table
      continue;
    }

    // Check if it's an array
    if (Array.isArray(value)) {
      const childTableName = `${mainTableName}_${sanitizeSqlIdentifier(fieldName)}`;

      if (value.length > 0 && typeof value[0] === 'object') {
        // Create child table for array of objects
        const childTable = createChildTable(
          childTableName,
          value[0],
          mainTable,
          dialect
        );
        tables.push(childTable);
      } else if (value.length > 0) {
        // Create child table for array of primitives
        const childTable = createPrimitiveArrayTable(
          childTableName,
          mainTable,
          dialect
        );
        tables.push(childTable);
      }
      // Skip arrays in main table - they're normalized
      continue;
    }

    // Regular scalar field
    let sqlType = inferSqlType(fieldName, value, dialect);
    const isRequired = value !== null && value !== undefined;

    // Check if it's a self-referential foreign key
    let isSelfReferentialFK = false;
    if (fieldName.endsWith('_id')) {
      const baseName = fieldName.replace(/_id$/, '');
      // Common self-referential patterns
      const selfReferentialPatterns = ['manager', 'supervisor', 'parent', 'reports_to', 'referred_by'];

      if (selfReferentialPatterns.includes(baseName)) {
        isSelfReferentialFK = true;

        // Use the same type as the parent table's primary key
        const parentPK = mainTable.primaryKey || 'id';
        const parentPKColumn = mainTable.columns.find((c) => c.name === parentPK);
        if (parentPKColumn) {
          sqlType = parentPKColumn.type;
        }

        mainTable.foreignKeys.push({
          column: fieldName,
          referencedTable: mainTableName,
          referencedColumn: parentPK,
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
  parentTable: TableDefinition,
  dialect: 'postgres' | 'mysql' | 'sqlite'
): TableDefinition {
  const table: TableDefinition = {
    name: tableName,
    columns: [],
    foreignKeys: [],
    uniqueConstraints: [],
  };

  // Detect existing primary key in nested object
  const existingPK = detectPrimaryKey(nestedObject);

  if (existingPK) {
    // Use existing primary key
    table.primaryKey = existingPK;
    table.columns.push({
      name: existingPK,
      type: inferSqlType(existingPK, nestedObject[existingPK], dialect),
      nullable: false,
      isPrimaryKey: true,
    });
  } else {
    // Auto-generate PK only if none exists
    table.primaryKey = 'id';
    table.columns.push({
      name: 'id',
      type: dialect === 'postgres' ? 'SERIAL' : dialect === 'mysql' ? 'INT AUTO_INCREMENT' : 'INTEGER',
      nullable: false,
      isPrimaryKey: true,
    });
  }

  // Add foreign key to parent - use parent's actual PK column name and type
  const parentPK = parentTable.primaryKey || 'id';
  const parentPKColumn = parentTable.columns.find((c) => c.name === parentPK);
  const parentPKType = parentPKColumn?.type || 'INT';

  // Create FK column with same type as parent PK
  table.columns.push({
    name: `${toSnakeCase(parentTable.name)}_${parentPK}`,
    type: parentPKType,
    nullable: false,
  });

  table.foreignKeys.push({
    column: `${toSnakeCase(parentTable.name)}_${parentPK}`,
    referencedTable: parentTable.name,
    referencedColumn: parentPK,
  });

  // Add fields from nested object (skip PK as it's already added)
  for (const [fieldName, value] of Object.entries(nestedObject)) {
    if (fieldName === existingPK) continue; // Skip PK field

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
  parentTable: TableDefinition,
  dialect: 'postgres' | 'mysql' | 'sqlite'
): TableDefinition {
  const table: TableDefinition = {
    name: tableName,
    columns: [],
    foreignKeys: [],
    uniqueConstraints: [],
  };

  // Detect existing primary key in child object
  const existingPK = detectPrimaryKey(childObject);

  if (existingPK) {
    // Use existing primary key
    table.primaryKey = existingPK;
    table.columns.push({
      name: existingPK,
      type: inferSqlType(existingPK, childObject[existingPK], dialect),
      nullable: false,
      isPrimaryKey: true,
    });
  } else {
    // Auto-generate PK only if none exists
    table.primaryKey = 'id';
    table.columns.push({
      name: 'id',
      type: dialect === 'postgres' ? 'SERIAL' : dialect === 'mysql' ? 'INT AUTO_INCREMENT' : 'INTEGER',
      nullable: false,
      isPrimaryKey: true,
    });
  }

  // Add foreign key to parent - use parent's actual PK column name and type
  const parentPK = parentTable.primaryKey || 'id';
  const parentPKColumn = parentTable.columns.find((c) => c.name === parentPK);
  const parentPKType = parentPKColumn?.type || 'INT';

  // Create FK column with same type as parent PK
  const parentIdColumn = `${toSnakeCase(parentTable.name)}_${parentPK}`;
  table.columns.push({
    name: parentIdColumn,
    type: parentPKType,
    nullable: false,
  });

  table.foreignKeys.push({
    column: parentIdColumn,
    referencedTable: parentTable.name,
    referencedColumn: parentPK,
  });

  // Add fields from child object (skip PK as it's already added)
  for (const [fieldName, value] of Object.entries(childObject)) {
    if (fieldName === existingPK) continue; // Skip PK field

    const sqlType = inferSqlType(fieldName, value, dialect);
    table.columns.push({
      name: fieldName,
      type: sqlType,
      nullable: value === null || value === undefined,
    });
  }

  return table;
}

function createPrimitiveArrayTable(
  tableName: string,
  parentTable: TableDefinition,
  dialect: 'postgres' | 'mysql' | 'sqlite'
): TableDefinition {
  const table: TableDefinition = {
    name: tableName,
    columns: [],
    foreignKeys: [],
    uniqueConstraints: [],
  };

  // Add auto-increment PK
  table.primaryKey = 'id';
  table.columns.push({
    name: 'id',
    type: dialect === 'postgres' ? 'SERIAL' : dialect === 'mysql' ? 'INT AUTO_INCREMENT' : 'INTEGER',
    nullable: false,
    isPrimaryKey: true,
  });

  // Add foreign key to parent - use parent's actual PK column name and type
  const parentPK = parentTable.primaryKey || 'id';
  const parentPKColumn = parentTable.columns.find((c) => c.name === parentPK);
  const parentPKType = parentPKColumn?.type || 'INT';

  // Create FK column with same type as parent PK
  const parentIdColumn = `${toSnakeCase(parentTable.name)}_${parentPK}`;
  table.columns.push({
    name: parentIdColumn,
    type: parentPKType,
    nullable: false,
  });

  table.foreignKeys.push({
    column: parentIdColumn,
    referencedTable: parentTable.name,
    referencedColumn: parentPK,
  });

  // Add value column for primitive values
  table.columns.push({
    name: 'value',
    type: 'VARCHAR(255)',
    nullable: false,
  });

  return table;
}

function inferSqlType(
  fieldName: string,
  value: any,
  dialect: 'postgres' | 'mysql' | 'sqlite'
): string {
  const lowerFieldName = fieldName.toLowerCase();

  // MongoDB _id field should always be TEXT to store ObjectId strings
  if (lowerFieldName === '_id') {
    return 'TEXT';
  }

  // Other ID fields (foreign keys like user_id, product_id, etc.)
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

function isUniqueField(fieldName: string, _value: any): boolean {
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
