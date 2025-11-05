import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Database,
  CheckCircle2,
  Circle,
  ArrowRight,
  Play,
  Download,
  AlertCircle,
  Server,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  testConnection,
  introspectSchema,
  startMigration,
  getMigrationStatus,
  type DatabaseConnection,
  type ConnectionTestResult,
  type TableSchema,
  type MigrationLog,
  type MigrationProgress,
} from '@/lib/api';

type Step = 1 | 2 | 3 | 4;

export default function Migrate() {
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Source connection
  const [sourceConn, setSourceConn] = useState<DatabaseConnection>({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
  });
  const [sourceStatus, setSourceStatus] = useState<ConnectionTestResult | null>(null);
  const [testingSource, setTestingSource] = useState(false);
  const [sourceSchema, setSourceSchema] = useState<TableSchema[]>([]);

  // Target connection
  const [targetConn, setTargetConn] = useState<DatabaseConnection>({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
  });
  const [targetStatus, setTargetStatus] = useState<ConnectionTestResult | null>(null);
  const [testingTarget, setTestingTarget] = useState(false);

  // Schema & Migration
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [batchSize, setBatchSize] = useState(1000);
  const [migrationId, setMigrationId] = useState<string | null>(null);
  const [migrationLogs, setMigrationLogs] = useState<MigrationLog[]>([]);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress[]>([]);
  const [migrating, setMigrating] = useState(false);

  const handleTestSource = async () => {
    setTestingSource(true);
    try {
      const result = await testConnection(sourceConn);
      setSourceStatus(result);
      if (result.success) {
        toast.success('Source connection successful!');
      } else {
        toast.error(`Connection failed: ${result.message}`);
      }
    } catch (error) {
      toast.error('Connection test failed');
      setSourceStatus({ success: false, message: 'Connection failed' });
    } finally {
      setTestingSource(false);
    }
  };

  const handleTestTarget = async () => {
    setTestingTarget(true);
    try {
      const result = await testConnection(targetConn);
      setTargetStatus(result);
      if (result.success) {
        toast.success('Target connection successful!');
      } else {
        toast.error(`Connection failed: ${result.message}`);
      }
    } catch (error) {
      toast.error('Connection test failed');
      setTargetStatus({ success: false, message: 'Connection failed' });
    } finally {
      setTestingTarget(false);
    }
  };

  const handleLoadSchema = async () => {
    try {
      const result = await introspectSchema(sourceConn);
      if (result.success) {
        setSourceSchema(result.schema);
        setSelectedTables(result.schema.map((t) => t.name));
        toast.success(`Loaded ${result.schema.length} tables`);
        setCurrentStep(3);
      }
    } catch (error) {
      toast.error('Failed to load schema');
    }
  };

  const handleStartMigration = async () => {
    setMigrating(true);
    try {
      const result = await startMigration({
        source: sourceConn,
        target: targetConn,
        tables: selectedTables,
        batchSize,
      });

      if (result.success) {
        setMigrationId(result.migrationId);
        toast.success('Migration started!');
        setCurrentStep(4);

        // Poll for status
        pollMigrationStatus(result.migrationId);
      }
    } catch (error) {
      toast.error('Failed to start migration');
      setMigrating(false);
    }
  };

  const pollMigrationStatus = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await getMigrationStatus(id);
        setMigrationLogs(status.logs);
        setMigrationProgress(status.progress);

        // Check if all tables are completed or failed
        const allDone = status.progress.every(
          (p) => p.status === 'completed' || p.status === 'failed'
        );

        if (allDone) {
          clearInterval(interval);
          setMigrating(false);
          const allSuccess = status.progress.every((p) => p.status === 'completed');
          if (allSuccess) {
            toast.success('Migration completed successfully!');
          } else {
            toast.error('Migration completed with errors');
          }
        }
      } catch (error) {
        clearInterval(interval);
        setMigrating(false);
      }
    }, 1000);
  };

  const downloadLogs = () => {
    const logsText = migrationLogs
      .map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs downloaded');
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-4 mb-8">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              step < currentStep
                ? 'bg-primary border-primary text-primary-foreground'
                : step === currentStep
                ? 'border-primary text-primary'
                : 'border-muted text-muted-foreground'
            }`}
          >
            {step < currentStep ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <span>{step}</span>
            )}
          </div>
          {step < 4 && (
            <ArrowRight
              className={`mx-2 h-5 w-5 ${
                step < currentStep ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderSourceConnection = () => (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Source Database</CardTitle>
        <CardDescription>Connect to the database you want to migrate from</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Database Type</Label>
          <Select
            value={sourceConn.type}
            onValueChange={(v) => setSourceConn({ ...sourceConn, type: v as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="postgres">PostgreSQL</SelectItem>
              <SelectItem value="mysql">MySQL</SelectItem>
              <SelectItem value="sqlite">SQLite</SelectItem>
              <SelectItem value="mongodb">MongoDB</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {sourceConn.type === 'sqlite' ? (
          <div>
            <Label>File Path</Label>
            <Input
              value={sourceConn.filePath || ''}
              onChange={(e) => setSourceConn({ ...sourceConn, filePath: e.target.value })}
              placeholder="/path/to/database.db"
            />
          </div>
        ) : sourceConn.type === 'mongodb' ? (
          <div>
            <Label>MongoDB URI</Label>
            <Input
              value={sourceConn.uri || ''}
              onChange={(e) => setSourceConn({ ...sourceConn, uri: e.target.value })}
              placeholder="mongodb://localhost:27017/mydb"
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Host</Label>
                <Input
                  value={sourceConn.host || ''}
                  onChange={(e) => setSourceConn({ ...sourceConn, host: e.target.value })}
                  placeholder="localhost"
                />
              </div>
              <div>
                <Label>Port</Label>
                <Input
                  type="number"
                  value={sourceConn.port || ''}
                  onChange={(e) => setSourceConn({ ...sourceConn, port: parseInt(e.target.value) })}
                  placeholder={sourceConn.type === 'postgres' ? '5432' : '3306'}
                />
              </div>
            </div>
            <div>
              <Label>Database</Label>
              <Input
                value={sourceConn.database || ''}
                onChange={(e) => setSourceConn({ ...sourceConn, database: e.target.value })}
                placeholder="database_name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Username</Label>
                <Input
                  value={sourceConn.username || ''}
                  onChange={(e) => setSourceConn({ ...sourceConn, username: e.target.value })}
                  placeholder="username"
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={sourceConn.password || ''}
                  onChange={(e) => setSourceConn({ ...sourceConn, password: e.target.value })}
                  placeholder="password"
                />
              </div>
            </div>
          </>
        )}

        <Button onClick={handleTestSource} disabled={testingSource} className="w-full">
          {testingSource ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Server className="h-4 w-4 mr-2" />
              Test Connection
            </>
          )}
        </Button>

        {sourceStatus && (
          <div
            className={`p-3 rounded-md border ${
              sourceStatus.success
                ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
            }`}
          >
            <p className={`text-sm font-medium ${sourceStatus.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
              {sourceStatus.message}
            </p>
            {sourceStatus.version && (
              <p className="text-xs text-muted-foreground mt-1">Version: {sourceStatus.version}</p>
            )}
          </div>
        )}

        <Button
          onClick={() => setCurrentStep(2)}
          disabled={!sourceStatus?.success}
          className="w-full"
          size="lg"
        >
          Next: Target Database
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );

  const renderTargetConnection = () => (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Target Database</CardTitle>
        <CardDescription>Connect to the destination database</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Database Type</Label>
          <Select
            value={targetConn.type}
            onValueChange={(v) => setTargetConn({ ...targetConn, type: v as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="postgres">PostgreSQL</SelectItem>
              <SelectItem value="mysql">MySQL</SelectItem>
              <SelectItem value="sqlite">SQLite</SelectItem>
              <SelectItem value="mongodb">MongoDB</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {targetConn.type === 'sqlite' ? (
          <div>
            <Label>File Path</Label>
            <Input
              value={targetConn.filePath || ''}
              onChange={(e) => setTargetConn({ ...targetConn, filePath: e.target.value })}
              placeholder="/path/to/database.db"
            />
          </div>
        ) : targetConn.type === 'mongodb' ? (
          <div>
            <Label>MongoDB URI</Label>
            <Input
              value={targetConn.uri || ''}
              onChange={(e) => setTargetConn({ ...targetConn, uri: e.target.value })}
              placeholder="mongodb://localhost:27017/mydb"
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Host</Label>
                <Input
                  value={targetConn.host || ''}
                  onChange={(e) => setTargetConn({ ...targetConn, host: e.target.value })}
                  placeholder="localhost"
                />
              </div>
              <div>
                <Label>Port</Label>
                <Input
                  type="number"
                  value={targetConn.port || ''}
                  onChange={(e) => setTargetConn({ ...targetConn, port: parseInt(e.target.value) })}
                  placeholder={targetConn.type === 'postgres' ? '5432' : '3306'}
                />
              </div>
            </div>
            <div>
              <Label>Database</Label>
              <Input
                value={targetConn.database || ''}
                onChange={(e) => setTargetConn({ ...targetConn, database: e.target.value })}
                placeholder="database_name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Username</Label>
                <Input
                  value={targetConn.username || ''}
                  onChange={(e) => setTargetConn({ ...targetConn, username: e.target.value })}
                  placeholder="username"
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={targetConn.password || ''}
                  onChange={(e) => setTargetConn({ ...targetConn, password: e.target.value })}
                  placeholder="password"
                />
              </div>
            </div>
          </>
        )}

        <Button onClick={handleTestTarget} disabled={testingTarget} className="w-full">
          {testingTarget ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Server className="h-4 w-4 mr-2" />
              Test Connection
            </>
          )}
        </Button>

        {targetStatus && (
          <div
            className={`p-3 rounded-md border ${
              targetStatus.success
                ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
            }`}
          >
            <p className={`text-sm font-medium ${targetStatus.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
              {targetStatus.message}
            </p>
            {targetStatus.version && (
              <p className="text-xs text-muted-foreground mt-1">Version: {targetStatus.version}</p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={() => setCurrentStep(1)} variant="outline" className="flex-1">
            Back
          </Button>
          <Button
            onClick={handleLoadSchema}
            disabled={!targetStatus?.success}
            className="flex-1"
            size="lg"
          >
            Next: Select Tables
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderSchemaMapping = () => (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Select Tables</CardTitle>
        <CardDescription>Choose which tables to migrate</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-4">
            <Label>Tables ({sourceSchema.length} found)</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedTables(sourceSchema.map((t) => t.name))}
              >
                Select All
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedTables([])}>
                Deselect All
              </Button>
            </div>
          </div>

          <div className="border rounded-md max-h-[400px] overflow-y-auto">
            {sourceSchema.map((table) => (
              <div
                key={table.name}
                className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedTables.includes(table.name)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedTables([...selectedTables, table.name]);
                    } else {
                      setSelectedTables(selectedTables.filter((t) => t !== table.name));
                    }
                  }}
                />
                <div className="flex-1">
                  <p className="font-medium">{table.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {table.columns.length} columns, {table.primaryKeys.length} PK
                    {table.foreignKeys.length > 0 && `, ${table.foreignKeys.length} FK`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label>Batch Size</Label>
          <Input
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(parseInt(e.target.value) || 1000)}
            placeholder="1000"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Number of rows to migrate at once
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setCurrentStep(2)} variant="outline" className="flex-1">
            Back
          </Button>
          <Button
            onClick={handleStartMigration}
            disabled={selectedTables.length === 0 || migrating}
            className="flex-1"
            size="lg"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Migration
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderMigration = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Step 4: Migration Progress</CardTitle>
          <CardDescription>Real-time migration status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {migrationProgress.map((progress) => (
            <div key={progress.table} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">{progress.table}</span>
                <span className="text-sm text-muted-foreground">
                  {progress.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : progress.status === 'failed' ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    `${progress.migratedRows} / ${progress.totalRows} rows`
                  )}
                </span>
              </div>
              <Progress value={progress.percentage} />
              {progress.error && (
                <p className="text-xs text-red-500">{progress.error}</p>
              )}
            </div>
          ))}

          {!migrating && migrationProgress.length > 0 && (
            <Button onClick={downloadLogs} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download Logs
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Migration Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-md p-4 max-h-[300px] overflow-y-auto font-mono text-xs space-y-1">
            {migrationLogs.map((log, idx) => (
              <div
                key={idx}
                className={`${
                  log.level === 'error'
                    ? 'text-red-500'
                    : log.level === 'warn'
                    ? 'text-yellow-500'
                    : 'text-foreground'
                }`}
              >
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">Database Migration</h1>
          <p className="text-muted-foreground">
            Live migration tools for transferring data between databases
          </p>
        </motion.div>

        {renderStepIndicator()}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStep === 1 && renderSourceConnection()}
            {currentStep === 2 && renderTargetConnection()}
            {currentStep === 3 && renderSchemaMapping()}
            {currentStep === 4 && renderMigration()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
