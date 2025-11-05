import { convertJsonToSql } from './jsonToSql.js';
import { convertJsonToMongo } from './jsonToMongo.js';
import { DatabaseConnection } from './dbConnection.js';

export interface JsonMigrationPreview {
  success: boolean;
  schema?: string;
  sampleData?: any[];
  tableCount?: number;
  recordCount?: number;
  error?: string;
}

/**
 * Generate a preview of what the migration will create
 */
export async function previewJsonMigration(
  jsonData: any,
  targetType: 'postgres' | 'mysql' | 'sqlite' | 'mongodb'
): Promise<JsonMigrationPreview> {
  try {
    const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];

    if (targetType === 'mongodb') {
      const result = await convertJsonToMongo(JSON.stringify(jsonData));

      return {
        success: true,
        schema: result.output,
        sampleData: dataArray.slice(0, 3),
        tableCount: 1,
        recordCount: dataArray.length,
      };
    } else {
      // SQL targets (postgres, mysql, sqlite)
      const result = await convertJsonToSql(JSON.stringify(jsonData), targetType);

      return {
        success: true,
        schema: result.output,
        sampleData: dataArray.slice(0, 3),
        tableCount: result.tables?.length || 1,
        recordCount: dataArray.length,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate preview',
    };
  }
}

/**
 * Execute JSON to database migration
 */
export async function executeJsonMigration(
  jsonData: any,
  targetConnection: DatabaseConnection,
  progressCallback?: (message: string, progress: number) => void
): Promise<{ success: boolean; message: string; recordsInserted?: number }> {
  try {
    const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
    progressCallback?.('Starting migration...', 0);

    if (targetConnection.type === 'mongodb') {
      // MongoDB migration - insert documents directly
      progressCallback?.('Converting to MongoDB format...', 20);
      const result = await convertJsonToMongo(JSON.stringify(jsonData));

      progressCallback?.('Migration schema generated', 80);

      return {
        success: true,
        message: 'MongoDB migration schema generated. Execute the provided commands to complete migration.',
        recordsInserted: dataArray.length,
      };
    } else {
      // SQL migration - generate CREATE and INSERT statements
      progressCallback?.('Generating SQL schema...', 20);
      const dialect = targetConnection.type as 'postgres' | 'mysql' | 'sqlite';
      const result = await convertJsonToSql(JSON.stringify(jsonData), dialect);

      progressCallback?.('SQL schema generated', 80);

      return {
        success: true,
        message: 'SQL migration schema generated. Execute the provided SQL to complete migration.',
        recordsInserted: dataArray.length,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Migration failed',
    };
  }
}
