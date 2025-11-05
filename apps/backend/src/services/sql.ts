import NodeSQLParser from 'node-sql-parser';

const parser = new NodeSQLParser.Parser();

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyDefinition[];
  indexes: IndexDefinition[];
  constraints: ConstraintDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  autoIncrement?: boolean;
}

export interface ForeignKeyDefinition {
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ConstraintDefinition {
  type: 'CHECK' | 'UNIQUE' | 'NOT NULL';
  columns: string[];
  expression?: string;
}

export function parseSql(sql: string, dialect: 'postgres' | 'mysql' | 'sqlite' = 'postgres'): TableDefinition[] {
  try {
    const opt = { database: dialect === 'postgres' ? 'postgresql' : dialect };
    const ast = parser.astify(sql, opt);

    const tables: TableDefinition[] = [];
    const astArray = Array.isArray(ast) ? ast : [ast];

    for (const statement of astArray) {
      if (statement.type === 'create' && statement.keyword === 'table') {
        const table = parseCreateTable(statement);
        if (table) {
          tables.push(table);
        }
      }
    }

    return tables;
  } catch (error) {
    throw new Error(`SQL parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function parseCreateTable(statement: any): TableDefinition | null {
  const tableName = typeof statement.table === 'string' ? statement.table : statement.table?.[0]?.table;

  if (!tableName) return null;

  const columns: ColumnDefinition[] = [];
  const primaryKeys: string[] = [];
  const foreignKeys: ForeignKeyDefinition[] = [];
  const indexes: IndexDefinition[] = [];
  const constraints: ConstraintDefinition[] = [];

  if (statement.create_definitions) {
    for (const def of statement.create_definitions) {
      if (def.column) {
        // Column definition
        const column: ColumnDefinition = {
          name: def.column.column,
          type: parseDataType(def.definition),
          nullable: !def.nullable?.value || def.nullable.value !== 'not null',
          autoIncrement: def.auto_increment,
        };

        if (def.default_val) {
          column.defaultValue = def.default_val.value?.value || def.default_val.value;
        }

        columns.push(column);
      } else if (def.constraint_type === 'primary key') {
        // Primary key constraint
        if (def.definition) {
          primaryKeys.push(...def.definition.map((d: any) => d.column));
        }
      } else if (def.constraint_type === 'foreign key') {
        // Foreign key constraint
        if (def.definition && def.reference_definition) {
          foreignKeys.push({
            column: def.definition[0]?.column || '',
            referencedTable: def.reference_definition.table?.[0]?.table || '',
            referencedColumn: def.reference_definition.definition?.[0]?.column || '',
            onDelete: def.reference_definition.on_delete,
            onUpdate: def.reference_definition.on_update,
          });
        }
      } else if (def.constraint_type === 'unique') {
        // Unique constraint
        constraints.push({
          type: 'UNIQUE',
          columns: def.definition?.map((d: any) => d.column) || [],
        });
      }
    }
  }

  return {
    name: tableName,
    columns,
    primaryKeys,
    foreignKeys,
    indexes,
    constraints,
  };
}

function parseDataType(definition: any): string {
  if (!definition) return 'VARCHAR(255)';

  if (definition.dataType) {
    let type = definition.dataType.toUpperCase();

    if (definition.length) {
      type += `(${definition.length})`;
    } else if (definition.scale) {
      type += `(${definition.precision},${definition.scale})`;
    }

    return type;
  }

  return 'VARCHAR(255)';
}

export function validateSql(sql: string, dialect: 'postgres' | 'mysql' | 'sqlite' = 'postgres'): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    parseSql(sql, dialect);
    return { valid: true, errors: [] };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown validation error');
    return { valid: false, errors };
  }
}
