import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Key, Link, Database, Hash, Calendar, Type } from 'lucide-react';

export interface TableNodeData {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    isUnique?: boolean;
    isNullable?: boolean;
    references?: {
      table: string;
      column: string;
    };
  }>;
  indexes?: Array<{
    name: string;
    columns: string[];
  }>;
}

function TableNode({ data, selected }: NodeProps<TableNodeData>) {
  const getTypeIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('int') || lowerType.includes('number') || lowerType.includes('serial')) {
      return <Hash className="h-3 w-3" />;
    }
    if (lowerType.includes('date') || lowerType.includes('time')) {
      return <Calendar className="h-3 w-3" />;
    }
    return <Type className="h-3 w-3" />;
  };

  return (
    <div
      className={`
        bg-white dark:bg-gray-900 rounded-lg shadow-lg border-2 min-w-[280px]
        ${selected ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-300 dark:border-gray-700'}
        transition-all duration-200
      `}
    >
      {/* Table Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-900 px-4 py-3 rounded-t-md">
        <div className="flex items-center gap-2 text-white">
          <Database className="h-4 w-4" />
          <span className="font-bold text-sm">{data.name}</span>
        </div>
      </div>

      {/* Columns List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {data.columns.map((column, idx) => (
          <div
            key={idx}
            className={`
              px-4 py-2 flex items-center gap-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
              ${column.isPrimaryKey ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
            `}
          >
            {/* PK/FK Icon */}
            <div className="flex-shrink-0 w-4">
              {column.isPrimaryKey && (
                <div title="Primary Key">
                  <Key className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                </div>
              )}
              {column.isForeignKey && !column.isPrimaryKey && (
                <div title="Foreign Key">
                  <Link className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
              )}
            </div>

            {/* Column Name */}
            <span
              className={`
                flex-1 font-medium
                ${column.isPrimaryKey ? 'text-yellow-900 dark:text-yellow-100' : 'text-gray-900 dark:text-gray-100'}
              `}
              title={column.references ? `References ${column.references.table}(${column.references.column})` : ''}
            >
              {column.name}
            </span>

            {/* Type Icon + Type */}
            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              {getTypeIcon(column.type)}
              <span className="text-xs">{column.type}</span>
            </div>

            {/* Nullable indicator */}
            {column.isNullable && (
              <span className="text-gray-400 text-xs">NULL</span>
            )}
          </div>
        ))}
      </div>

      {/* Indexes Footer */}
      {data.indexes && data.indexes.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-b-md border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <span className="font-semibold">Indexes:</span> {data.indexes.length}
          </div>
        </div>
      )}

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-blue-500 border-2 border-white dark:border-gray-900"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-blue-500 border-2 border-white dark:border-gray-900"
      />
    </div>
  );
}

export default memo(TableNode);
