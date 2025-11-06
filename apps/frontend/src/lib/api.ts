import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ConvertRequest {
  from: 'sql' | 'mongo' | 'json';
  to: 'sql' | 'mongo' | 'json';
  content: string;
  options?: {
    dialect?: 'postgres' | 'mysql' | 'sqlite' | 'mongodb';
    ai?: boolean;
  };
}

export interface ConvertResponse {
  artifacts: Record<string, string>;
  summary: any;
  warnings: string[];
  aiSuggestions?: string;
}

export interface AnalyzeRequest {
  content: string;
  type: 'sql' | 'mongo' | 'json';
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'table' | 'collection' | 'schema';
  data: any;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: 'foreign_key' | 'reference' | 'relationship';
}

export interface AnalyzeResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const convertSchema = async (request: ConvertRequest): Promise<ConvertResponse> => {
  const response = await api.post<ConvertResponse>('/api/convert', request);
  return response.data;
};

export const analyzeSchema = async (request: AnalyzeRequest): Promise<AnalyzeResponse> => {
  const response = await api.post<AnalyzeResponse>('/api/analyze', request);
  return response.data;
};

export const checkHealth = async (): Promise<{ ok: boolean }> => {
  const response = await api.get('/health');
  return response.data;
};

// Migration API

export interface DatabaseConnection {
  type: 'postgres' | 'mysql' | 'sqlite' | 'mongodb' | 'json';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  filePath?: string;
  uri?: string;
  jsonData?: any;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  version?: string;
  databases?: string[];
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKeys: string[];
  foreignKeys: ForeignKeySchema[];
  indexes: IndexSchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  maxLength?: number;
}

export interface ForeignKeySchema {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface MigrationProgress {
  table: string;
  totalRows: number;
  migratedRows: number;
  percentage: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export interface MigrationLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  table?: string;
}

export const testConnection = async (
  connection: DatabaseConnection
): Promise<ConnectionTestResult> => {
  const response = await api.post<ConnectionTestResult>(
    '/api/migrate/test-connection',
    connection
  );
  return response.data;
};

export const introspectSchema = async (
  connection: DatabaseConnection
): Promise<{ success: boolean; schema: TableSchema[] }> => {
  const response = await api.post('/api/migrate/introspect-schema', connection);
  return response.data;
};

export const startMigration = async (config: {
  source: DatabaseConnection;
  target: DatabaseConnection;
  tables: string[];
  batchSize?: number;
}): Promise<{ success: boolean; migrationId: string; message: string }> => {
  const response = await api.post('/api/migrate/start-migration', config);
  return response.data;
};

export const getMigrationStatus = async (
  migrationId: string
): Promise<{ logs: MigrationLog[]; progress: MigrationProgress[] }> => {
  const response = await api.get(`/api/migrate/migration-status/${migrationId}`);
  return response.data;
};

export interface JsonMigrationPreview {
  success: boolean;
  schema?: string;
  sampleData?: any[];
  sampleInserts?: string[];
  tableCount?: number;
  recordCount?: number;
  tableSummary?: Array<{ table: string; estimatedRows: number }>;
  error?: string;
}

export const previewJsonMigration = async (
  jsonData: any,
  targetType: 'postgres' | 'mysql' | 'sqlite' | 'mongodb'
): Promise<JsonMigrationPreview> => {
  const response = await api.post('/api/migrate/preview-json-migration', {
    jsonData,
    targetType,
  });
  return response.data;
};

export const executeJsonMigration = async (
  jsonData: any,
  targetConnection: DatabaseConnection
): Promise<{
  success: boolean;
  message: string;
  recordsInserted: number;
  tableDetails: Array<{ table: string; rows: number }>;
  errors?: string[];
}> => {
  const response = await api.post('/api/migrate/execute-json-migration', {
    jsonData,
    targetConnection,
  });
  return response.data;
};

// General migration (works for ALL source types)
export const previewMigration = async (
  sourceConnection: DatabaseConnection,
  targetType: string
): Promise<JsonMigrationPreview> => {
  const response = await api.post('/api/migrate/preview-migration', {
    sourceConnection,
    targetType,
  });
  return response.data;
};

export const executeMigration = async (
  sourceConnection: DatabaseConnection,
  targetConnection: DatabaseConnection
): Promise<{
  success: boolean;
  message: string;
  recordsInserted: number;
  tableDetails: Array<{ table: string; rows: number }>;
  errors?: string[];
}> => {
  const response = await api.post('/api/migrate/execute-migration', {
    sourceConnection,
    targetConnection,
  });
  return response.data;
};
