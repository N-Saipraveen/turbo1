import { useState, useCallback } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { analyzeSchema, type AnalyzeRequest } from '@/lib/api';

export default function Visualize() {
  const [type, setType] = useState<'sql' | 'mongo' | 'json'>('sql');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleAnalyze = async () => {
    if (!content.trim()) {
      toast.error('Please enter schema content to visualize');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Analyzing schema...');

    try {
      const request: AnalyzeRequest = {
        content,
        type,
      };

      const response = await analyzeSchema(request);

      // Convert API response to React Flow format
      const flowNodes: Node[] = response.nodes.map((node, idx) => ({
        id: node.id,
        type: 'default',
        position: { x: (idx % 3) * 300, y: Math.floor(idx / 3) * 200 },
        data: {
          label: (
            <div className="px-4 py-2">
              <div className="font-bold text-sm">{node.label}</div>
              <div className="text-xs text-gray-500">{node.type}</div>
              {node.data && (
                <div className="text-xs mt-1">
                  {Object.entries(node.data).map(([key, value]) => (
                    <div key={key}>
                      {key}: {String(value)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ),
        },
        style: {
          background: node.type === 'table' ? '#e3f2fd' : node.type === 'collection' ? '#f3e5f5' : '#fff3e0',
          border: '2px solid #333',
          borderRadius: '8px',
          padding: 0,
        },
      }));

      const flowEdges: Edge[] = response.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: 'smoothstep',
        animated: edge.type === 'foreign_key',
        style: { stroke: edge.type === 'foreign_key' ? '#3b82f6' : '#6b7280' },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);

      toast.success('Schema analyzed successfully!', { id: loadingToast });
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        id: loadingToast,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">Visualize Schema</h1>
          <p className="text-muted-foreground">
            Interactive ER diagrams and schema relationships
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Input Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Input</CardTitle>
                <CardDescription>Enter schema to visualize</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Schema Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sql">SQL</SelectItem>
                      <SelectItem value="mongo">MongoDB</SelectItem>
                      <SelectItem value="json">JSON Schema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Schema Content</Label>
                  <Textarea
                    placeholder="Paste your schema here..."
                    className="min-h-[200px] font-mono text-xs"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <Button onClick={handleAnalyze} disabled={loading} className="w-full">
                  {loading ? 'Analyzing...' : 'Visualize'}
                </Button>

                <div className="pt-4 border-t space-y-2">
                  <p className="text-sm font-medium">Graph Stats</p>
                  <div className="text-xs space-y-1">
                    <div>Nodes: {nodes.length}</div>
                    <div>Edges: {edges.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Visualization Canvas */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-3"
          >
            <Card className="h-[600px]">
              <CardContent className="p-0 h-full">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  fitView
                >
                  <Background />
                  <Controls />
                  <MiniMap />
                </ReactFlow>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
