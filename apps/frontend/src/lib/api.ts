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
