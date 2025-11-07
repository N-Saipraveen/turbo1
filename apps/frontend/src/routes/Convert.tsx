import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Download, Sparkles, ArrowRight, Copy, Eye, Upload, Maximize2, Minimize2, X } from 'lucide-react';
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
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { convertSchema, convertMongoToSql, analyzeSchema, type ConvertRequest, type ConvertResponse } from '@/lib/api';
import { SchemaEditor } from '@/components/SchemaEditor';

export default function Convert() {
  const [from, setFrom] = useState<'sql' | 'mongo' | 'json'>('json');
  const [to, setTo] = useState<'sql' | 'mongo' | 'json'>('sql');
  const [content, setContent] = useState('');
  const [dialect, setDialect] = useState<'postgres' | 'mysql' | 'sqlite'>('postgres');
  const [useAi, setUseAi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConvertResponse | null>(null);
  const [showVisualization, setShowVisualization] = useState(false);
  const [visualizing, setVisualizing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isMongoShell, setIsMongoShell] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Detect MongoDB Shell syntax
  const detectMongoShell = (text: string): boolean => {
    const patterns = [
      /db\.createCollection/,
      /db\.\w+\.insert/,
      /db\.\w+\.find/,
      /\/\//,  // Comments
      /\/\*/,  // Multi-line comments
      /ObjectId\(/,
      /ISODate\(/,
    ];
    return patterns.some(pattern => pattern.test(text));
  };

  // Handle content change with MongoDB Shell detection
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (from === 'mongo') {
      setIsMongoShell(detectMongoShell(newContent));
    }
  };

  // Get editor language based on source format
  const getEditorLanguage = (): 'javascript' | 'sql' | 'json' => {
    if (from === 'mongo') return 'javascript';
    if (from === 'sql') return 'sql';
    return 'json';
  };

  const detectFileFormat = (filename: string): 'sql' | 'mongo' | 'json' | null => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'sql') return 'sql';
    if (ext === 'json' || ext === 'bson') return 'json';
    if (ext === 'yaml' || ext === 'yml') return 'json'; // Will parse YAML as JSON
    if (ext === 'dbml') return 'sql'; // DBML treated as SQL-like
    return null;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const format = detectFileFormat(file.name);
    if (!format) {
      toast.error('Unsupported file format. Use .json, .sql, .bson, .yaml, or .dbml');
      return;
    }

    try {
      const text = await file.text();
      setContent(text);
      setFrom(format);
      toast.success(`Loaded ${file.name}`);

      // Auto-convert if AI is enabled
      if (useAi) {
        setTimeout(() => handleConvert(), 500);
      }
    } catch (error) {
      toast.error('Failed to read file');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConvert = async () => {
    if (!content.trim()) {
      toast.error('Please enter schema content to convert');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Converting schema...');

    try {
      let response: ConvertResponse;

      // Use dedicated server-side endpoint for MongoDB → SQL
      if (from === 'mongo' && to === 'sql') {
        response = await convertMongoToSql(content, dialect);
      } else {
        // Use general conversion endpoint for other conversions
        const request: ConvertRequest = {
          from,
          to,
          content,
          options: {
            dialect,
            ai: useAi,
          },
        };
        response = await convertSchema(request);
      }

      setResult(response);

      if (response.warnings.length > 0) {
        response.warnings.forEach(warning => toast(warning, { icon: '⚠️' }));
      }

      toast.success('Conversion successful!', { id: loadingToast });
    } catch (error) {
      console.error('Conversion error:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error occurred during conversion';

      toast.error(`Conversion failed: ${errorMessage}`, {
        id: loadingToast,
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const handleVisualize = async () => {
    if (!result) {
      toast.error('Please convert a schema first');
      return;
    }

    setVisualizing(true);
    const loadingToast = toast.loading('Generating visualization...');

    try {
      // Use the converted output for visualization
      const targetContent = to === 'sql'
        ? Object.values(result.artifacts).join('\n\n')
        : content;

      const response = await analyzeSchema({
        content: targetContent,
        type: to,
      });

      // Convert API response to React Flow format
      const flowNodes: Node[] = response.nodes.map((node, idx) => ({
        id: node.id,
        type: 'default',
        position: { x: (idx % 3) * 350, y: Math.floor(idx / 3) * 220 },
        data: {
          label: (
            <div className="px-4 py-2 min-w-[180px]">
              <div className="font-bold text-sm mb-1">{node.label}</div>
              <div className="text-xs text-muted-foreground mb-2">{node.type}</div>
              {node.data && (
                <div className="text-xs space-y-0.5">
                  {Object.entries(node.data).slice(0, 3).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-2">
                      <span className="font-medium">{key}:</span>
                      <span className="text-muted-foreground">{String(value)}</span>
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
          minWidth: 180,
        },
      }));

      const flowEdges: Edge[] = response.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: 'smoothstep',
        animated: edge.type === 'foreign_key',
        style: { stroke: edge.type === 'foreign_key' ? '#3b82f6' : '#6b7280', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edge.type === 'foreign_key' ? '#3b82f6' : '#6b7280',
        },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
      setShowVisualization(true);

      toast.success('Visualization generated!', { id: loadingToast });
    } catch (error) {
      console.error('Visualization error:', error);
      toast.error(`Visualization failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        id: loadingToast,
      });
    } finally {
      setVisualizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background p-6">
      <div className="container mx-auto max-w-[1800px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Convert Schema
          </h1>
          <p className="text-muted-foreground">
            Transform your database schemas between different formats with full normalization
          </p>
        </motion.div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Input Schema (3 cols) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="col-span-12 lg:col-span-3"
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Source</CardTitle>
                <CardDescription>Input your schema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Format</Label>
                  <Select value={from} onValueChange={(v) => setFrom(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sql">SQL</SelectItem>
                      <SelectItem value="mongo">MongoDB</SelectItem>
                      <SelectItem value="json">JSON/Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {from === 'sql' && (
                  <div>
                    <Label>SQL Dialect</Label>
                    <Select value={dialect} onValueChange={(v) => setDialect(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="postgres">PostgreSQL</SelectItem>
                        <SelectItem value="mysql">MySQL</SelectItem>
                        <SelectItem value="sqlite">SQLite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>Upload File</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.sql,.bson,.yaml,.yml,.dbml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    .json, .sql, .bson, .yaml, .dbml
                  </p>
                </div>

                <div>
                  <Label>Schema Content</Label>
                  <div className="mt-2">
                    <SchemaEditor
                      value={content}
                      onChange={handleContentChange}
                      language={getEditorLanguage()}
                      height="400px"
                      placeholder="Paste your schema here or upload a file..."
                    />
                  </div>
                  {isMongoShell && from === 'mongo' && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                      <div className="flex items-start gap-2">
                        <span className="font-semibold">ℹ️ MongoDB Shell syntax detected</span>
                      </div>
                      <p className="mt-1 text-xs">
                        Comments, createCollection commands, and MongoDB-specific syntax (ObjectId, ISODate) are supported and will be automatically preprocessed.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={useAi} onCheckedChange={setUseAi} />
                    <Label className="flex items-center gap-1 cursor-pointer">
                      <Sparkles className="h-4 w-4 text-pink-500" />
                      <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-semibold">AI Enhance</span>
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Middle Column: Controls (2 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="col-span-12 lg:col-span-2 flex flex-col items-center justify-center"
          >
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-center">Convert</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Target Format</Label>
                  <Select value={to} onValueChange={(v) => setTo(v as any)}>
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

                <div className="flex justify-center py-8">
                  <motion.div
                    animate={{
                      x: [0, 10, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      repeatType: 'loop',
                    }}
                  >
                    <ArrowRight className="h-12 w-12 text-primary" />
                  </motion.div>
                </div>

                <Button
                  onClick={handleConvert}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  size="lg"
                >
                  {loading ? 'Converting...' : 'Convert Schema'}
                </Button>

                {result && (
                  <div className="pt-4 space-y-2 border-t border-purple-200">
                    <p className="text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Summary</p>
                    <div className="text-xs bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 border border-purple-200 p-3 rounded-md space-y-1">
                      {Object.entries(result.summary).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-medium text-purple-700">{key}:</span>
                          <span className="text-pink-700">{JSON.stringify(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Right Column: Output (7 cols) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="col-span-12 lg:col-span-7"
          >
            <Card className="h-full">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Output</CardTitle>
                    <CardDescription>Converted schema artifacts</CardDescription>
                  </div>
                  {result && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleVisualize}
                        disabled={visualizing}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {visualizing ? 'Generating...' : 'Visualize'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFullscreen(!fullscreen)}
                      >
                        {fullscreen ? (
                          <Minimize2 className="h-4 w-4" />
                        ) : (
                          <Maximize2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {result ? (
                  <div className="space-y-4">
                    <Tabs defaultValue={Object.keys(result.artifacts)[0] || 'none'} className="w-full">
                      <TabsList className="w-full overflow-x-auto flex justify-start">
                        {Object.keys(result.artifacts).map((filename) => (
                          <TabsTrigger key={filename} value={filename} className="text-xs whitespace-nowrap">
                            {filename.length > 20 ? `${filename.substring(0, 17)}...` : filename}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {Object.entries(result.artifacts).map(([filename, fileContent]) => (
                        <TabsContent key={filename} value={filename} className="space-y-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(fileContent)}
                            >
                              <Copy className="h-4 w-4 mr-1" />
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadFile(filename, fileContent)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                          </div>
                          <pre
                            className="text-xs bg-muted p-4 rounded-md overflow-auto font-mono whitespace-pre-wrap break-words"
                            style={{
                              maxHeight: fullscreen ? 'calc(100vh - 300px)' : '500px',
                              minHeight: '300px'
                            }}
                          >
                            {fileContent}
                          </pre>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>
                ) : (
                  <div className="text-center py-20 text-muted-foreground">
                    <p className="text-lg mb-2">No output yet</p>
                    <p className="text-sm">Convert a schema to see results here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Visualization Panel */}
        <AnimatePresence>
          {showVisualization && nodes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 20, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6"
            >
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Schema Visualization</CardTitle>
                      <CardDescription>
                        Interactive diagram - {nodes.length} tables, {edges.length} relationships
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowVisualization(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[600px] border rounded-lg overflow-hidden bg-background">
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onConnect={onConnect}
                      fitView
                      minZoom={0.2}
                      maxZoom={2}
                    >
                      <Background color="#aaa" gap={16} />
                      <Controls />
                      <MiniMap
                        nodeColor={(node) => {
                          const style = node.style as any;
                          return style?.background || '#fff';
                        }}
                      />
                    </ReactFlow>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
