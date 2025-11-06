import { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MiniMap,
  NodeTypes,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Download,
  Image,
  FileJson,
  Search,
  Layers,
  Moon,
  Sun,
  FileCode,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import TableNode, { TableNodeData } from '@/components/TableNode';
import { SchemaEditor } from '@/components/SchemaEditor';
import { parseSchema, detectSchemaType, SchemaType } from '@/lib/schemaParser';
import { getLayoutedElements, LayoutOptions } from '@/lib/autoLayout';
import {
  exportToPng,
  exportToSvg,
  downloadDbml,
  downloadSchemaJson,
  copyToClipboard,
} from '@/lib/exportUtils';
import { sampleSchemas } from '@/lib/sampleSchemas';

// Register custom node types
const nodeTypes: NodeTypes = {
  table: TableNode,
};

export default function Visualize() {
  const [type, setType] = useState<SchemaType>('sql');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<LayoutOptions['direction']>('TB');

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Get language for Monaco Editor
  const getEditorLanguage = (): 'javascript' | 'sql' | 'json' => {
    if (type === 'mongo') return 'javascript';
    if (type === 'sql') return 'sql';
    return 'json';
  };

  // Filter nodes based on search
  const filteredNodes = useMemo(() => {
    if (!searchTerm) return nodes;

    return nodes.filter((node) => {
      const data = node.data as TableNodeData;
      return data.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [nodes, searchTerm]);

  // Handle schema parsing and visualization
  const handleVisualize = async () => {
    if (!content.trim()) {
      toast.error('Please enter schema content to visualize');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Parsing schema...');

    try {
      // Auto-detect type if needed
      const detectedType = type || detectSchemaType(content);

      // Parse schema
      const schema = parseSchema(content, detectedType);

      if (schema.tables.length === 0) {
        throw new Error('No tables found in schema');
      }

      // Convert to React Flow format
      const flowNodes: Node<TableNodeData>[] = schema.tables.map((table, idx) => ({
        id: table.name,
        type: 'table',
        position: { x: 0, y: 0 }, // Will be set by layout
        data: table,
      }));

      // Convert relationships to edges
      const flowEdges: Edge[] = schema.relationships.map((rel, idx) => ({
        id: `${rel.fromTable}-${rel.fromColumn}-${rel.toTable}-${idx}`,
        source: rel.fromTable,
        target: rel.toTable,
        type: 'smoothstep',
        animated: true,
        label: `${rel.fromColumn} → ${rel.toColumn}`,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        markerEnd: {
          type: 'arrowclosed',
          color: '#3b82f6',
        },
      }));

      // Apply auto-layout
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        flowNodes,
        flowEdges,
        {
          direction: layoutDirection,
          nodeWidth: 300,
          nodeHeight: 200,
        }
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      toast.success(`Visualized ${schema.tables.length} tables`, { id: loadingToast });
    } catch (error) {
      console.error('Visualization error:', error);
      toast.error(`Failed to visualize: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        id: loadingToast,
      });
    } finally {
      setLoading(false);
    }
  };

  // Re-apply layout
  const handleReLayout = () => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, {
      direction: layoutDirection,
      nodeWidth: 300,
      nodeHeight: 200,
    });
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    toast.success('Layout updated');
  };

  // Load sample schema
  const handleLoadSample = (sampleName: string) => {
    const sample = sampleSchemas.find((s) => s.name === sampleName);
    if (sample) {
      setType(sample.type);
      setContent(sample.content);
      toast.success(`Loaded: ${sample.name}`);
    }
  };

  // Export handlers
  const handleExportPng = async () => {
    try {
      await exportToPng('diagram', 'schema-diagram.png');
      toast.success('Exported as PNG');
    } catch (error) {
      toast.error('Failed to export PNG');
    }
  };

  const handleExportSvg = async () => {
    try {
      await exportToSvg('diagram', 'schema-diagram.svg');
      toast.success('Exported as SVG');
    } catch (error) {
      toast.error('Failed to export SVG');
    }
  };

  const handleExportDbml = () => {
    try {
      const schema = parseSchema(content, type);
      downloadDbml(schema, 'schema.dbml');
      toast.success('DBML downloaded');
    } catch (error) {
      toast.error('Failed to generate DBML');
    }
  };

  const handleCopyDbml = async () => {
    try {
      const schema = parseSchema(content, type);
      const dbml = await import('@/lib/exportUtils').then((m) => m.generateDbml(schema));
      await copyToClipboard(dbml);
      toast.success('DBML copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy DBML');
    }
  };

  const handleExportJson = () => {
    try {
      const schema = parseSchema(content, type);
      downloadSchemaJson(schema, 'schema.json');
      toast.success('JSON downloaded');
    } catch (error) {
      toast.error('Failed to download JSON');
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-gray-950' : 'bg-background'} p-6`}>
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Schema Visualizer</h1>
              <p className="text-muted-foreground">
                Enterprise-grade ER diagram visualization
              </p>
            </div>

            {/* Theme Toggle */}
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              <Switch checked={isDarkMode} onCheckedChange={setIsDarkMode} />
              <Moon className="h-4 w-4" />
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Left Panel - Input & Controls */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            {/* Schema Type Selector */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label>Schema Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as SchemaType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sql">SQL (PostgreSQL/MySQL)</SelectItem>
                      <SelectItem value="mongo">MongoDB</SelectItem>
                      <SelectItem value="json">JSON Schema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Load Sample</Label>
                  <Select onValueChange={handleLoadSample}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose sample..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sampleSchemas.map((sample) => (
                        <SelectItem key={sample.name} value={sample.name}>
                          {sample.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Layout Direction</Label>
                  <Select
                    value={layoutDirection}
                    onValueChange={(v) => setLayoutDirection(v as LayoutOptions['direction'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TB">Top to Bottom</SelectItem>
                      <SelectItem value="LR">Left to Right</SelectItem>
                      <SelectItem value="BT">Bottom to Top</SelectItem>
                      <SelectItem value="RL">Right to Left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Schema Editor */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <Label>Schema Content</Label>
                <div className="border rounded-lg overflow-hidden">
                  <SchemaEditor
                    value={content}
                    onChange={setContent}
                    language={getEditorLanguage()}
                    height="300px"
                    placeholder="Paste your schema here..."
                  />
                </div>

                <Button onClick={handleVisualize} disabled={loading} className="w-full">
                  {loading ? 'Parsing...' : 'Visualize Schema'}
                </Button>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-semibold">Graph Statistics</p>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <div>Tables: {nodes.length}</div>
                  <div>Relationships: {edges.length}</div>
                  <div>
                    Filtered: {searchTerm ? filteredNodes.length : nodes.length}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right Panel - Visualization */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-3"
          >
            <Card className="h-[800px]">
              <CardContent className="p-0 h-full relative">
                <ReactFlow
                  nodes={searchTerm ? filteredNodes : nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  nodeTypes={nodeTypes}
                  fitView
                  className={isDarkMode ? 'dark' : ''}
                >
                  <Background />
                  <Controls />
                  <MiniMap
                    nodeColor={(node) => {
                      return '#3b82f6';
                    }}
                    className="bg-white dark:bg-gray-800"
                  />

                  {/* Toolbar Panel */}
                  <Panel position="top-left" className="flex flex-wrap gap-2 m-4">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search tables..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-48 bg-white dark:bg-gray-800"
                      />
                    </div>

                    {/* Re-Layout Button */}
                    <Button
                      onClick={handleReLayout}
                      size="sm"
                      variant="outline"
                      className="bg-white dark:bg-gray-800"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Re-Layout
                    </Button>

                    {/* Export Dropdown */}
                    <Select onValueChange={(action) => {
                      switch (action) {
                        case 'png':
                          handleExportPng();
                          break;
                        case 'svg':
                          handleExportSvg();
                          break;
                        case 'dbml':
                          handleExportDbml();
                          break;
                        case 'json':
                          handleExportJson();
                          break;
                        case 'copy-dbml':
                          handleCopyDbml();
                          break;
                      }
                    }}>
                      <SelectTrigger className="w-40 bg-white dark:bg-gray-800">
                        <Download className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Export" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="png">
                          <div className="flex items-center gap-2">
                            <Image className="h-4 w-4" />
                            Export PNG
                          </div>
                        </SelectItem>
                        <SelectItem value="svg">
                          <div className="flex items-center gap-2">
                            <Image className="h-4 w-4" />
                            Export SVG
                          </div>
                        </SelectItem>
                        <SelectItem value="dbml">
                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4" />
                            Download DBML
                          </div>
                        </SelectItem>
                        <SelectItem value="copy-dbml">
                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4" />
                            Copy DBML
                          </div>
                        </SelectItem>
                        <SelectItem value="json">
                          <div className="flex items-center gap-2">
                            <FileJson className="h-4 w-4" />
                            Download JSON
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Panel>

                  {/* Empty State */}
                  {nodes.length === 0 && (
                    <Panel position="top-center" className="mt-32">
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center max-w-md">
                        <Layers className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">No Schema Loaded</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Paste your SQL, MongoDB, or JSON schema in the editor and click
                          "Visualize Schema" to see the ER diagram
                        </p>
                        <Button
                          onClick={() => handleLoadSample('E-commerce Database')}
                          variant="outline"
                        >
                          <Maximize2 className="h-4 w-4 mr-2" />
                          Load Sample
                        </Button>
                      </div>
                    </Panel>
                  )}
                </ReactFlow>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
