import { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Download, Sparkles, ArrowRight, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { convertSchema, type ConvertRequest, type ConvertResponse } from '@/lib/api';

export default function Convert() {
  const [from, setFrom] = useState<'sql' | 'mongo' | 'json'>('sql');
  const [to, setTo] = useState<'sql' | 'mongo' | 'json'>('json');
  const [content, setContent] = useState('');
  const [dialect, setDialect] = useState<'postgres' | 'mysql' | 'sqlite'>('postgres');
  const [useAi, setUseAi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConvertResponse | null>(null);

  const handleConvert = async () => {
    if (!content.trim()) {
      toast.error('Please enter schema content to convert');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Converting schema...');

    try {
      const request: ConvertRequest = {
        from,
        to,
        content,
        options: {
          dialect,
          ai: useAi,
        },
      };

      const response = await convertSchema(request);
      setResult(response);

      if (response.warnings.length > 0) {
        response.warnings.forEach(warning => toast(warning, { icon: '⚠️' }));
      }

      toast.success('Conversion successful!', { id: loadingToast });
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        id: loadingToast,
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">Convert Schema</h1>
          <p className="text-muted-foreground">
            Transform your database schemas between different formats
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Source Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
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
                      <SelectItem value="json">JSON Schema</SelectItem>
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
                  <Label>Schema Content</Label>
                  <Textarea
                    placeholder="Paste your schema here..."
                    className="min-h-[300px] font-mono text-xs"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={useAi} onCheckedChange={setUseAi} />
                    <Label className="flex items-center gap-1">
                      <Sparkles className="h-4 w-4" />
                      AI Refine
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Mapping Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center justify-center"
          >
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Conversion</CardTitle>
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
                  className="w-full"
                  size="lg"
                >
                  {loading ? 'Converting...' : 'Convert Schema'}
                </Button>

                {result && (
                  <div className="pt-4 space-y-2">
                    <p className="text-sm font-medium">Summary</p>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32">
                      {JSON.stringify(result.summary, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Output Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Output</CardTitle>
                <CardDescription>Converted schema artifacts</CardDescription>
              </CardHeader>
              <CardContent>
                {result ? (
                  <Tabs defaultValue={Object.keys(result.artifacts)[0] || 'none'}>
                    <TabsList className="w-full">
                      {Object.keys(result.artifacts).map((filename) => (
                        <TabsTrigger key={filename} value={filename} className="text-xs">
                          {filename.split('.')[0]}
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
                        <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-[400px] font-mono">
                          {fileContent}
                        </pre>
                      </TabsContent>
                    ))}
                  </Tabs>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Converted output will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
