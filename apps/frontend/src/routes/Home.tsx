import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Database, ArrowRightLeft, Eye, Upload, Zap, Shield, GitBranch, Sparkles, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const navigate = useNavigate();

  const databases = [
    { name: 'PostgreSQL', color: 'text-blue-600' },
    { name: 'MySQL', color: 'text-orange-600' },
    { name: 'MongoDB', color: 'text-green-600' },
    { name: 'SQLite', color: 'text-slate-600' },
    { name: 'JSON', color: 'text-yellow-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      {/* Top Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative overflow-hidden"
      >
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 py-3">
          <div className="container mx-auto px-4">
            <p className="text-center text-white text-sm md:text-base font-medium flex items-center justify-center gap-2 flex-wrap">
              <span>Built with</span>
              <motion.span
                animate={{
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="inline-block"
              >
                <Heart className="h-4 w-4 fill-red-500 text-red-500 inline" />
              </motion.span>
              <span>by</span>
              <span className="font-bold">Sai Praveen</span>
              <span>&</span>
              <span className="font-bold">Abhiram</span>
              <span className="hidden sm:inline">for</span>
              <span className="font-bold bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                VIT-AP Capstone Project
              </span>
            </p>
          </div>
        </div>
        {/* Animated gradient border bottom */}
        <motion.div
          className="h-1 bg-gradient-to-r from-transparent via-white to-transparent"
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </motion.div>

      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="inline h-3 w-3 mr-1" />
            Universal Database Converter
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-pink-500">
            TurboDbx
          </h1>
          <p className="text-2xl md:text-3xl font-semibold text-foreground/90 mb-4">
            Migrate SQL ⇄ NoSQL ⇄ JSON in minutes
          </p>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            No scripting required. Professional-grade database migration with full schema conversion,
            data normalization, and real-time progress tracking.
          </p>

          <div className="flex gap-4 justify-center mb-12">
            <Button
              size="lg"
              className="text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all"
              onClick={() => navigate('/migrate')}
            >
              <Database className="mr-2 h-5 w-5" />
              Start Migration
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 rounded-full"
              onClick={() => navigate('/convert')}
            >
              <ArrowRightLeft className="mr-2 h-5 w-5" />
              Try Converter
            </Button>
          </div>

          {/* Supported Databases */}
          <div className="flex flex-wrap items-center justify-center gap-6 py-6 border-y">
            <span className="text-sm text-muted-foreground font-medium">SUPPORTED DATABASES:</span>
            {databases.map((db) => (
              <div key={db.name} className="flex items-center gap-2">
                <Database className={`h-5 w-5 ${db.color}`} />
                <span className="text-sm font-medium">{db.name}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 h-full flex flex-col"
              onClick={() => navigate('/convert')}
            >
              <CardHeader className="flex-grow">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <ArrowRightLeft className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Convert</CardTitle>
                </div>
                <CardDescription className="min-h-[3rem]">
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
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 h-full flex flex-col"
              onClick={() => navigate('/visualize')}
            >
              <CardHeader className="flex-grow">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Eye className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Visualize</CardTitle>
                </div>
                <CardDescription className="min-h-[3rem]">
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
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 h-full flex flex-col"
              onClick={() => navigate('/migrate')}
            >
              <CardHeader className="flex-grow">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Database className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Migrate</CardTitle>
                </div>
                <CardDescription className="min-h-[3rem]">
                  Execute live database migrations with batch processing and progress tracking
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

        {/* Key Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-16"
        >
          <h2 className="text-3xl font-bold text-center mb-12">
            Why Choose TurboDbx?
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="p-3 rounded-lg bg-blue-500/10 w-fit mb-2">
                  <Zap className="h-6 w-6 text-blue-500" />
                </div>
                <CardTitle className="text-lg">Lightning Fast</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Migrate millions of records with optimized batch processing and real-time progress
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="p-3 rounded-lg bg-green-500/10 w-fit mb-2">
                  <Shield className="h-6 w-6 text-green-500" />
                </div>
                <CardTitle className="text-lg">Production Ready</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  ACID compliance, transaction safety, and automatic rollback on errors
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="p-3 rounded-lg bg-purple-500/10 w-fit mb-2">
                  <GitBranch className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle className="text-lg">Smart Mapping</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Intelligent type conversion, primary key detection, and relationship inference
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="p-3 rounded-lg bg-pink-500/10 w-fit mb-2">
                  <Eye className="h-6 w-6 text-pink-500" />
                </div>
                <CardTitle className="text-lg">Visual Tools</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Interactive ER diagrams, Monaco code editor, and live schema preview
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-16 bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 rounded-3xl p-12"
        >
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">100%</div>
              <div className="text-muted-foreground">Schema Accuracy</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">5+ Types</div>
              <div className="text-muted-foreground">Database Support</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">Zero Code</div>
              <div className="text-muted-foreground">Configuration Needed</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
