import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Database, ArrowRightLeft, Eye, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            TurboDbx
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Universal Database Converter - Transform SQL ⇄ NoSQL ⇄ JSON with ease
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
              onClick={() => navigate('/convert')}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <ArrowRightLeft className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Convert</CardTitle>
                </div>
                <CardDescription>
                  Transform schemas and data between SQL, MongoDB, and JSON formats
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Start Converting</Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
              onClick={() => navigate('/visualize')}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Eye className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Visualize</CardTitle>
                </div>
                <CardDescription>
                  View ER diagrams and schema relationships in an interactive graph
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Visualize Schema</Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
              onClick={() => navigate('/migrate')}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Database className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Migrate</CardTitle>
                </div>
                <CardDescription>
                  Run live migrations from source to target database
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Start Migration</Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="border-dashed border-2">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-muted">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
              <CardTitle>Quick Start</CardTitle>
              <CardDescription>
                Drop your SQL, JSON, or MongoDB schema files here to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => navigate('/convert')}>
                Choose Files or Click to Convert
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-16 text-center"
        >
          <h2 className="text-2xl font-semibold mb-6">Features</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="p-4">
              <h3 className="font-semibold mb-2">AI-Assisted</h3>
              <p className="text-sm text-muted-foreground">
                Intelligent schema mapping with AI suggestions
              </p>
            </div>
            <div className="p-4">
              <h3 className="font-semibold mb-2">Type Safe</h3>
              <p className="text-sm text-muted-foreground">
                Robust parsing with strict validation
              </p>
            </div>
            <div className="p-4">
              <h3 className="font-semibold mb-2">Visual</h3>
              <p className="text-sm text-muted-foreground">
                Interactive ER diagrams and data previews
              </p>
            </div>
            <div className="p-4">
              <h3 className="font-semibold mb-2">Local First</h3>
              <p className="text-sm text-muted-foreground">
                Runs entirely on your machine
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
