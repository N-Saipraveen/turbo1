import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Database,
  CheckCircle2,
  ArrowRight,
  Play,
  Download,
  Eye,
  FileJson,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUpload } from '@/components/FileUpload';
import {
  testConnection,
  previewJsonMigration,
  executeJsonMigration,
  previewMigration,
  executeMigration,
  type DatabaseConnection,
  type JsonMigrationPreview,
} from '@/lib/api';

type Step = 1 | 2 | 3 | 4;

export default function Migrate() {
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Source configuration
  const [sourceType, setSourceType] = useState<DatabaseConnection['type']>('postgres');
  const [sourceConn, setSourceConn] = useState<DatabaseConnection>({
    type: 'postgres',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
  });
  const [sourceJsonData, setSourceJsonData] = useState<any>(null);
  const [sourceConnected, setSourceConnected] = useState(false);

  // Target configuration
  const [targetType, setTargetType] = useState<DatabaseConnection['type']>('postgres');
  const [targetConn, setTargetConn] = useState<DatabaseConnection>({
    type: 'postgres',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
  });
  const [targetConnected, setTargetConnected] = useState(false);

  // Preview
  const [preview, setPreview] = useState<JsonMigrationPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Migration execution
  const [migrating, setMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string>('');
  const [recordsInserted, setRecordsInserted] = useState<number>(0);
  const [tableDetails, setTableDetails] = useState<Array<{ table: string; rows: number }>>([]);

  // Handle source type change
  const handleSourceTypeChange = (type: string) => {
    setSourceType(type as DatabaseConnection['type']);
    setSourceConnected(false);
    setSourceJsonData(null);

    if (type === 'json') {
      setSourceConn({ type: 'json' });
    } else if (type === 'mongodb') {
      // MongoDB uses URI-based connection
      setSourceConn({
        type: 'mongodb',
        uri: '',
        database: '',
      });
    } else {
      // SQL databases use host/port/username/password
      setSourceConn({
        type: type as any,
        host: '',
        port: type === 'mysql' ? 3306 : 5432,
        database: '',
        username: '',
        password: '',
      });
    }
  };

  // Handle JSON upload
  const handleJsonUpload = async (data: any) => {
    setSourceJsonData(data);
    setSourceConn({ type: 'json', jsonData: data });
    setSourceConnected(true);
    toast.success('JSON data uploaded successfully!');
  };

  // Test source connection
  const handleTestSourceConnection = async () => {
    if (sourceType === 'json') {
      // JSON already validated
      setSourceConnected(true);
      toast.success('JSON data ready for migration');
      return;
    }

    try {
      const result = await testConnection(sourceConn);
      if (result.success) {
        setSourceConnected(true);
        toast.success('Source database connected!');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Connection failed');
    }
  };

  // Test target connection
  const handleTestTargetConnection = async () => {
    try {
      const result = await testConnection(targetConn);
      if (result.success) {
        setTargetConnected(true);
        toast.success('Target database connected!');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Connection failed');
    }
  };

  // Generate preview
  const handleGeneratePreview = async () => {
    if (!sourceConnected) {
      toast.error('Please connect to source database first');
      return;
    }

    setLoadingPreview(true);
    try {
      // Use the general migration preview API that works for ALL source types
      const result = await previewMigration(
        sourceConn,
        targetType
      );

      if (result.success) {
        setPreview(result);
        toast.success('Preview generated!');
      } else {
        toast.error(result.error || 'Preview generation failed');
      }
    } catch (error) {
      toast.error('Failed to generate preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Execute migration
  const handleRunMigration = async () => {
    if (!sourceConnected || !targetConnected) {
      toast.error('Please ensure both source and target databases are connected');
      return;
    }

    setMigrating(true);
    try {
      // Use the general migration API that works for ALL source→target combinations
      const result = await executeMigration(sourceConn, targetConn);

      if (result.success) {
        setMigrationComplete(true);
        setMigrationResult(result.message);
        setRecordsInserted(result.recordsInserted);
        setTableDetails(result.tableDetails || []);
        toast.success(`Migration completed! ${result.recordsInserted} records inserted across ${result.tableDetails?.length || 0} tables.`);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  // Step navigation helpers
  const canProgress = () => {
    if (currentStep === 1) return sourceConnected;
    if (currentStep === 2) return targetConnected;
    if (currentStep === 3) return preview !== null;
    return false;
  };

  const nextStep = () => {
    if (currentStep < 4 && canProgress()) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="mb-2 text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Database Migration
          </h1>
          <p className="text-gray-600">Migrate data from JSON or databases with ease</p>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8 flex justify-center"
        >
          <div className="flex items-center gap-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center gap-4">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className={`flex h-12 w-12 items-center justify-center rounded-full font-semibold shadow-lg transition-all ${
                    currentStep === step
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white scale-110'
                      : currentStep > step
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-gray-400'
                  }`}
                >
                  {currentStep > step ? <CheckCircle2 className="h-6 w-6" /> : step}
                </motion.div>
                {step < 4 && (
                  <div
                    className={`h-1 w-16 rounded-full ${
                      currentStep > step ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="mx-auto max-w-2xl"
            >
              <Card className="border-none shadow-2xl bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Database className="h-6 w-6 text-purple-500" />
                    Step 1: Select Source
                  </CardTitle>
                  <CardDescription>Choose your data source type</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Source Type</Label>
                    <Select value={sourceType} onValueChange={handleSourceTypeChange}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">
                          <div className="flex items-center gap-2">
                            <FileJson className="h-4 w-4" />
                            <span>JSON File</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="postgres">PostgreSQL</SelectItem>
                        <SelectItem value="mysql">MySQL</SelectItem>
                        <SelectItem value="sqlite">SQLite</SelectItem>
                        <SelectItem value="mongodb">MongoDB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {sourceType === 'json' ? (
                    <FileUpload onFileUpload={handleJsonUpload} />
                  ) : sourceType === 'mongodb' ? (
                    <div className="space-y-4">
                      <div>
                        <Label>MongoDB Connection URI</Label>
                        <Input
                          placeholder="mongodb+srv://username:password@cluster.mongodb.net"
                          value={sourceConn.uri || ''}
                          onChange={(e) =>
                            setSourceConn({ ...sourceConn, uri: e.target.value })
                          }
                          className="rounded-xl font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Use your full MongoDB connection string including credentials
                        </p>
                      </div>
                      <div>
                        <Label>Database Name</Label>
                        <Input
                          placeholder="myDatabase"
                          value={sourceConn.database}
                          onChange={(e) =>
                            setSourceConn({ ...sourceConn, database: e.target.value })
                          }
                          className="rounded-xl"
                        />
                      </div>
                      <Button
                        onClick={handleTestSourceConnection}
                        className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500"
                      >
                        Test Connection
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Host</Label>
                          <Input
                            placeholder="localhost"
                            value={sourceConn.host}
                            onChange={(e) =>
                              setSourceConn({ ...sourceConn, host: e.target.value })
                            }
                            className="rounded-xl"
                          />
                        </div>
                        <div>
                          <Label>Port</Label>
                          <Input
                            type="number"
                            value={sourceConn.port}
                            onChange={(e) =>
                              setSourceConn({ ...sourceConn, port: parseInt(e.target.value) })
                            }
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Database</Label>
                        <Input
                          value={sourceConn.database}
                          onChange={(e) =>
                            setSourceConn({ ...sourceConn, database: e.target.value })
                          }
                          className="rounded-xl"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Username</Label>
                          <Input
                            value={sourceConn.username}
                            onChange={(e) =>
                              setSourceConn({ ...sourceConn, username: e.target.value })
                            }
                            className="rounded-xl"
                          />
                        </div>
                        <div>
                          <Label>Password</Label>
                          <Input
                            type="password"
                            value={sourceConn.password}
                            onChange={(e) =>
                              setSourceConn({ ...sourceConn, password: e.target.value })
                            }
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleTestSourceConnection}
                        className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500"
                      >
                        Test Connection
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="mx-auto max-w-2xl"
            >
              <Card className="border-none shadow-2xl bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Database className="h-6 w-6 text-pink-500" />
                    Step 2: Select Target
                  </CardTitle>
                  <CardDescription>Choose your destination database</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Target Type</Label>
                    <Select
                      value={targetType}
                      onValueChange={(value) => {
                        setTargetType(value as any);
                        setTargetConnected(false);
                        setTargetConn({
                          type: value as any,
                          host: '',
                          port: value === 'mysql' ? 3306 : 5432,
                          database: '',
                          username: '',
                          password: '',
                        });
                      }}
                    >
                      <SelectTrigger className="rounded-xl">
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

                  <div className="space-y-4">
                    {targetType === 'sqlite' ? (
                      <div>
                        <Label>File Path</Label>
                        <Input
                          placeholder="/path/to/database.db"
                          value={targetConn.filePath || ''}
                          onChange={(e) =>
                            setTargetConn({ ...targetConn, filePath: e.target.value })
                          }
                          className="rounded-xl"
                        />
                      </div>
                    ) : targetType === 'mongodb' ? (
                      <div>
                        <Label>Connection URI</Label>
                        <Input
                          placeholder="mongodb://localhost:27017/database"
                          value={targetConn.uri || ''}
                          onChange={(e) => setTargetConn({ ...targetConn, uri: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Host</Label>
                            <Input
                              placeholder="localhost"
                              value={targetConn.host}
                              onChange={(e) =>
                                setTargetConn({ ...targetConn, host: e.target.value })
                              }
                              className="rounded-xl"
                            />
                          </div>
                          <div>
                            <Label>Port</Label>
                            <Input
                              type="number"
                              value={targetConn.port}
                              onChange={(e) =>
                                setTargetConn({
                                  ...targetConn,
                                  port: parseInt(e.target.value),
                                })
                              }
                              className="rounded-xl"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Database</Label>
                          <Input
                            value={targetConn.database}
                            onChange={(e) =>
                              setTargetConn({ ...targetConn, database: e.target.value })
                            }
                            className="rounded-xl"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Username</Label>
                            <Input
                              value={targetConn.username}
                              onChange={(e) =>
                                setTargetConn({ ...targetConn, username: e.target.value })
                              }
                              className="rounded-xl"
                            />
                          </div>
                          <div>
                            <Label>Password</Label>
                            <Input
                              type="password"
                              value={targetConn.password}
                              onChange={(e) =>
                                setTargetConn({ ...targetConn, password: e.target.value })
                              }
                              className="rounded-xl"
                            />
                          </div>
                        </div>
                      </>
                    )}
                    <Button
                      onClick={handleTestTargetConnection}
                      className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-purple-500"
                    >
                      Test Connection
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="mx-auto max-w-4xl"
            >
              <Card className="border-none shadow-2xl bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Eye className="h-6 w-6 text-blue-500" />
                    Step 3: Preview Migration
                  </CardTitle>
                  <CardDescription>Review the schema before migrating</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!preview ? (
                    <div className="text-center py-12">
                      <Button
                        onClick={handleGeneratePreview}
                        disabled={loadingPreview}
                        className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-500"
                        size="lg"
                      >
                        {loadingPreview ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Generating Preview...
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-5 w-5" />
                            Generate Preview
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 p-4 text-center">
                          <div className="text-3xl font-bold text-purple-700">
                            {preview.tableCount}
                          </div>
                          <div className="text-sm text-purple-600">Tables</div>
                        </div>
                        <div className="rounded-xl bg-gradient-to-br from-pink-100 to-pink-200 p-4 text-center">
                          <div className="text-3xl font-bold text-pink-700">
                            {preview.recordCount}
                          </div>
                          <div className="text-sm text-pink-600">Records</div>
                        </div>
                        <div className="rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 p-4 text-center">
                          <div className="text-3xl font-bold text-blue-700">
                            {targetType.toUpperCase()}
                          </div>
                          <div className="text-sm text-blue-600">Target</div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-lg font-semibold mb-2">Generated Schema</Label>
                        <pre className="rounded-xl bg-gray-900 p-6 text-sm text-green-400 overflow-auto max-h-96">
                          {preview.schema}
                        </pre>
                      </div>

                      {preview.tableSummary && preview.tableSummary.length > 0 && (
                        <div>
                          <Label className="text-lg font-semibold mb-2">Migration Plan</Label>
                          <div className="rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 p-4 space-y-2">
                            {preview.tableSummary.map((summary) => (
                              <div
                                key={summary.table}
                                className="flex justify-between items-center bg-white rounded-lg px-4 py-2 shadow-sm"
                              >
                                <span className="font-medium text-gray-700">{summary.table}</span>
                                <span className="font-bold text-purple-600">
                                  ~{summary.estimatedRows} rows
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {preview.sampleInserts && preview.sampleInserts.length > 0 && (
                        <div>
                          <Label className="text-lg font-semibold mb-2">
                            Sample INSERT Statements (First 5 Records)
                          </Label>
                          <pre className="rounded-xl bg-gray-900 p-6 text-sm text-blue-400 overflow-auto max-h-64">
                            {preview.sampleInserts.join('\n\n')}
                          </pre>
                        </div>
                      )}

                      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                        <p className="text-sm text-blue-800">
                          ✅ <strong>Ready to migrate:</strong> This will create {preview.tableCount}{' '}
                          {preview.tableCount === 1 ? 'table' : 'tables'} and insert{' '}
                          <strong>{preview.recordCount} total records</strong> into your {targetType.toUpperCase()} database.
                          All data from your source will be migrated with full relational normalization.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="mx-auto max-w-2xl"
            >
              <Card className="border-none shadow-2xl bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Play className="h-6 w-6 text-green-500" />
                    Step 4: Execute Migration
                  </CardTitle>
                  <CardDescription>Create tables and insert all data into target database</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!migrationComplete ? (
                    <div className="text-center py-12 space-y-4">
                      <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 max-w-md mx-auto">
                        <p className="text-sm text-yellow-800">
                          ⚠️ <strong>Ready to execute:</strong> This will create tables and insert{' '}
                          {preview?.recordCount || 0} records into your target database.
                        </p>
                      </div>
                      <Button
                        onClick={handleRunMigration}
                        disabled={migrating}
                        className="rounded-xl bg-gradient-to-r from-green-500 to-blue-500"
                        size="lg"
                      >
                        {migrating ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Creating Tables & Inserting Data...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-5 w-5" />
                            Execute Migration Now
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-center py-8 space-y-4"
                    >
                      <div className="rounded-full bg-green-500 p-6 w-24 h-24 mx-auto flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="h-12 w-12 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-green-700">Migration Complete!</h3>
                      <div className="rounded-xl bg-green-50 border border-green-200 p-4 max-w-md mx-auto space-y-3">
                        <div className="text-center space-y-2">
                          <div className="text-4xl font-bold text-green-700">{recordsInserted}</div>
                          <div className="text-sm text-green-600">Total Records Inserted</div>
                        </div>

                        {tableDetails && tableDetails.length > 0 && (
                          <div className="border-t border-green-200 pt-3">
                            <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                              Per-Table Breakdown
                            </div>
                            <div className="space-y-1">
                              {tableDetails.map((detail) => (
                                <div
                                  key={detail.table}
                                  className="flex justify-between items-center text-sm bg-white/50 rounded px-3 py-1"
                                >
                                  <span className="font-medium text-gray-700">{detail.table}</span>
                                  <span className="font-bold text-green-600">{detail.rows} rows</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-gray-600">{migrationResult}</p>
                      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 max-w-md mx-auto">
                        <p className="text-sm text-blue-800">
                          ✅ <strong>100% Complete:</strong> All {recordsInserted} records have been transferred
                          to your {targetType.toUpperCase()} database with full schema normalization and
                          foreign key relationships preserved.
                        </p>
                      </div>
                      {preview?.schema && (
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            const blob = new Blob([preview.schema || ''], {
                              type: 'text/plain',
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `migration-${targetType}.sql`;
                            a.click();
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download SQL
                        </Button>
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex justify-center gap-4"
        >
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="rounded-xl"
            size="lg"
          >
            Previous
          </Button>
          <Button
            onClick={nextStep}
            disabled={!canProgress() || currentStep === 4}
            className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500"
            size="lg"
          >
            {currentStep === 3 ? 'Continue to Execute' : 'Next'}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
