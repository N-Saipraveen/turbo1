import { motion } from 'framer-motion';
import { Database, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Migrate() {
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

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Database className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <CardTitle>Coming Soon</CardTitle>
                  <CardDescription>Live migration features are under development</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 border border-border rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">Planned Features:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Live database connections (PostgreSQL, MySQL, SQLite, MongoDB)</li>
                    <li>Real-time migration progress tracking</li>
                    <li>Data validation and integrity checks</li>
                    <li>Rollback capabilities</li>
                    <li>Batch processing for large datasets</li>
                  </ul>
                </div>
              </div>

              <div className="text-center pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  For now, you can use the Convert feature to generate migration scripts
                </p>
                <Button onClick={() => window.location.href = '/convert'}>
                  Go to Convert
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
